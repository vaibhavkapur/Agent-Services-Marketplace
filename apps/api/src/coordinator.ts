import { canReserve, validateTerms } from "@asm/budget-policy";
import {
  DILIGENCE_PRICE,
  LOOKUP_PRICE,
  MemoryStore,
  type InvocationRow,
  type TaskRow,
} from "@asm/db";
import { canFallbackProtocol, createInvocation, createPaymentAttempt } from "@asm/invocation-domain";
import { MppChargeClient, MPP_HEADERS } from "@asm/mpp-adapter";
import { classifyRecovery } from "@asm/reconciliation";
import {
  id,
  loadPins,
  parseAtomic,
  redact,
  snapshotFromTotals,
  type FaultName,
  type ProtocolName,
} from "@asm/shared";
import { IsolatedSigner } from "@asm/signer-interface";
import { X402Client, X402_HEADERS } from "@asm/x402-adapter";
import { header, hostOf, requestJson } from "./http.js";

const pins = loadPins();
const lookupUrl = process.env.LOOKUP_SERVICE_URL ?? "http://localhost:3002";
const extractionUrl = process.env.EXTRACTION_SERVICE_URL ?? "http://localhost:3003";
const allowedHosts = [hostOf(lookupUrl), hostOf(extractionUrl)];
const signer = new IsolatedSigner(pins, allowedHosts);
const x402Client = new X402Client(pins, signer);
const mppClient = new MppChargeClient(pins, signer);

export const store = new MemoryStore({ lookup: lookupUrl, extraction: extractionUrl });

export function budgetFor(task: TaskRow) {
  const totals = store.budgetTotals(task.id);
  const sessions = store.listSessions(task.id);
  const sessionLocked = sessions.reduce((sum, session) => sum + session.fundedAtomic - session.settledAtomic, 0n);
  const sessionConsumed = sessions.reduce((sum, session) => sum + session.authorizedUsageAtomic, 0n);
  return snapshotFromTotals({
    asset: task.budgetAsset,
    decimals: task.budgetDecimals,
    budget: task.budgetAtomic,
    completed: totals.completed,
    reserved: totals.reserved,
    sessionLocked: sessionLocked > 0n ? sessionLocked : 0n,
    sessionConsumed,
    networkFeeAllowance: task.networkFeeAllowanceAtomic,
    networkFeeSpent: 0n,
  });
}

export async function invokeLookup(input: {
  task: TaskRow;
  serviceId: "supplier_lookup" | "supplier_diligence";
  supplierId: string;
  protocol: ProtocolName;
  fault?: FaultName;
}): Promise<InvocationRow> {
  const service = store.getService(input.serviceId);
  if (!service) throw new Error("Unknown service");
  const advertised = input.serviceId === "supplier_diligence" ? DILIGENCE_PRICE : LOOKUP_PRICE;
  const path = input.serviceId === "supplier_diligence"
    ? `/v1/diligence/${input.supplierId}`
    : `/v1/suppliers/${input.supplierId}`;
  const url = `${lookupUrl}${path}`;
  const payload = { supplier_id: input.supplierId, service_id: input.serviceId };
  const created = createInvocation({
    taskId: input.task.id,
    serviceId: input.serviceId,
    businessKey: `${input.supplierId}:${input.protocol}`,
    payload,
  });

  return store.withTaskLock(input.task.id, async () => {
    const existing = store.findInvocationByKey(created.operationKey);
    if (existing?.invocationState === "completed" || existing?.resultReference) {
      return existing;
    }
    const invocation = existing ?? store.putInvocation({
      ...created,
      createdAt: new Date().toISOString(),
    });

    if (existing && existing.invocationState === "recovery_required") {
      return recoverPaidResult(invocation, url);
    }

    const profile = input.protocol === "mpp" ? "mpp-charge" : "x402-exact";
    const probe = await requestJson({
      url,
      headers: {
        "x-payment-profile": profile,
        "x-operation-key": invocation.operationKey,
        "x-demo-fault": input.fault ?? "none",
      },
    });
    store.addEvent({
      invocationId: invocation.id,
      protocol: input.protocol,
      stage: "quoted",
      redactedPayload: redact({ status: probe.status, headers: probe.headers, body: probe.json }),
    });
    invocation.invocationState = "quoted";

    if (probe.status === 200) {
      return completeFromBody(invocation, input.protocol, probe.json, advertised);
    }
    if (probe.status !== 402) {
      invocation.invocationState = "rejected";
      invocation.lastError = `Unexpected probe status ${probe.status}`;
      return store.putInvocation(invocation);
    }

    const terms = readTerms(input.protocol, probe, url);
    const decision = validateTerms({
      pins,
      terms,
      advertisedAtomic: advertised,
      allowedHosts,
      resourceHost: hostOf(url),
    });
    if (!decision.ok) {
      invocation.invocationState = "rejected";
      invocation.lastError = decision.reason;
      store.putInvocation(invocation);
      return invocation;
    }

    const snapshot = budgetFor(input.task);
    const remaining = parseAtomic(snapshot.available_atomic);
    const quoted = parseAtomic(terms.amountAtomic);
    const reserveDecision = canReserve(remaining, quoted);
    if (!reserveDecision.ok) {
      invocation.invocationState = "rejected";
      invocation.lastError = reserveDecision.reason;
      store.putInvocation(invocation);
      return invocation;
    }

    store.addJournal({
      taskId: input.task.id,
      entryType: "reserve",
      amountAtomic: quoted,
      operationRef: invocation.operationKey,
      idempotencyKey: `reserve:${invocation.operationKey}`,
    });
    invocation.invocationState = "budget_reserved";

    const attempt = createPaymentAttempt({
      invocationId: invocation.id,
      protocol: input.protocol,
      profileVersion: input.protocol === "x402" ? "x402-v2-exact" : "mpp-tempo.charge",
      asset: terms.asset,
      network: terms.network,
      amountAtomic: terms.amountAtomic,
      settlementKind: pins.settlementMode === "testnet" ? "network" : "simulated",
    });
    attempt.challengeReference = terms.challengeId;
    attempt.authorizationState = "authorized";
    attempt.settlementState = "settlement_pending";
    store.putPayment(attempt);

    invocation.invocationState = "authorizing";
    const auth = authorize(input.protocol, probe, invocation.operationKey, url, advertised);
    invocation.invocationState = "requesting";
    invocation.deliveryState = "processing";
    store.putInvocation(invocation);

    const paid = await requestJson({
      url,
      headers: {
        "x-payment-profile": profile,
        "x-operation-key": invocation.operationKey,
        "x-demo-fault": input.fault ?? "none",
        ...auth.headers,
      },
    });
    store.addEvent({
      invocationId: invocation.id,
      protocol: input.protocol,
      stage: "requesting",
      redactedPayload: redact({ status: paid.status, headers: paid.headers, body: paid.json }),
    });

    if (paid.status === 504 || paid.status >= 500) {
      attempt.settlementState = "outcome_unknown";
      invocation.invocationState = "recovery_required";
      invocation.deliveryState = "outcome_unknown";
      invocation.lastError = "Paid response was lost. Reservation held for recovery.";
      store.putPayment(attempt);
      store.putInvocation(invocation);
      return recoverPaidResult(invocation, url);
    }

    if (paid.status !== 200) {
      attempt.settlementState = "failed";
      attempt.failureReason = `Paid request failed with ${paid.status}`;
      store.addJournal({
        taskId: input.task.id,
        entryType: "release",
        amountAtomic: quoted,
        operationRef: invocation.operationKey,
        idempotencyKey: `release:${invocation.operationKey}`,
      });
      invocation.invocationState = "rejected";
      invocation.deliveryState = "failed";
      invocation.lastError = attempt.failureReason;
      store.putPayment(attempt);
      return store.putInvocation(invocation);
    }

    return completeFromBody(invocation, input.protocol, paid.json, terms.amountAtomic, attempt.id, paid.headers);
  });
}

export async function recoverPaidResult(invocation: InvocationRow, url: string): Promise<InvocationRow> {
  const recovered = await requestJson({
    url: `${lookupUrl}/v1/operations/${encodeURIComponent(invocation.operationKey)}`,
  });
  store.addEvent({
    invocationId: invocation.id,
    protocol: store.latestPayment(invocation.id)?.protocol ?? "x402",
    stage: "recovery",
    redactedPayload: redact({ status: recovered.status, body: recovered.json }),
  });
  if (recovered.status !== 200) {
    invocation.lastReconciledAt = new Date().toISOString();
    return store.putInvocation(invocation);
  }
  const body = recovered.json as { result?: unknown; protocol?: ProtocolName };
  return completeFromBody(invocation, body.protocol ?? "x402", { result: body.result }, LOOKUP_PRICE);
}

function completeFromBody(
  invocation: InvocationRow,
  protocol: ProtocolName,
  body: unknown,
  amountAtomic: string,
  paymentId?: string,
  headers?: Record<string, string>,
): InvocationRow {
  const envelope = body as {
    result?: unknown;
    settlement?: { settlementKind?: string; transaction?: string };
    receipt?: { settlementKind?: string; transaction?: string; challengeId?: string };
    replay?: boolean;
  };
  const result = envelope.result ?? body;
  const kind = (envelope.settlement?.settlementKind ?? envelope.receipt?.settlementKind ?? pins.settlementMode) as "simulated" | "network";
  const stored = store.putResult({
    id: id("res"),
    invocationId: invocation.id,
    payload: result,
    schemaVersion: (result as { schema_version?: string })?.schema_version ?? "supplier-profile-v1",
    checksum: JSON.stringify(result).length.toString(16),
    provenance: {
      service_id: invocation.serviceId,
      protocol,
      settlement_kind: kind,
      purchased: true,
    },
  });
  store.addJournal({
    taskId: invocation.taskId,
    entryType: "commit",
    amountAtomic: parseAtomic(amountAtomic),
    operationRef: invocation.operationKey,
    idempotencyKey: `commit:${invocation.operationKey}`,
  });
  const payment = paymentId ? store.payments.get(paymentId) : store.latestPayment(invocation.id);
  if (payment) {
    payment.authorizationState = "authorized";
    payment.settlementState = "settled";
    payment.settlementKind = kind;
    payment.transactionReference = envelope.settlement?.transaction ?? envelope.receipt?.transaction;
    payment.receiptReference = envelope.receipt?.challengeId ?? stored.id;
    if (headers) {
      payment.challengeReference = header(headers, X402_HEADERS.response) ?? header(headers, MPP_HEADERS.receipt);
    }
    store.putPayment(payment);
  }
  invocation.invocationState = "completed";
  invocation.deliveryState = "retrieved";
  invocation.resultReference = stored.id;
  invocation.lastError = invocation.lastError?.includes("lost")
    ? "Recovered the paid result without issuing another charge."
    : undefined;
  invocation.lastReconciledAt = new Date().toISOString();
  return store.putInvocation(invocation);
}

function readTerms(protocol: ProtocolName, probe: { headers: Record<string, string> }, url: string) {
  if (protocol === "x402") {
    const required = x402Client.readRequired(probe.headers);
    const accept = required?.accepts[0];
    if (!required || !accept) throw new Error("Missing x402 payment requirements.");
    return {
      asset: accept.asset,
      network: accept.network,
      amountAtomic: accept.amount,
      payTo: accept.payTo,
      expiresAt: Math.floor(Date.now() / 1000) + accept.maxTimeoutSeconds,
      resource: required.resource.url,
      scheme: accept.scheme,
      challengeId: header(probe.headers, X402_HEADERS.required),
    };
  }
  const challenge = mppClient.readChallenge(probe.headers);
  if (!challenge) throw new Error("Missing MPP challenge.");
  return {
    asset: challenge.currency,
    network: `eip155:${challenge.chainId}`,
    amountAtomic: challenge.amount,
    payTo: challenge.recipient,
    expiresAt: challenge.expiresAt,
    resource: challenge.resource || url,
    method: challenge.method,
    challengeId: challenge.challengeId,
  };
}

function authorize(
  protocol: ProtocolName,
  probe: { headers: Record<string, string> },
  operationKey: string,
  url: string,
  advertisedAtomic: string,
): { headers: Record<string, string> } {
  if (protocol === "x402") {
    const required = x402Client.readRequired(probe.headers);
    if (!required) throw new Error("Cannot authorize without x402 requirements.");
    return { headers: x402Client.authorize({ required, operationKey, resourceHost: hostOf(url), advertisedAtomic }).header };
  }
  const challenge = mppClient.readChallenge(probe.headers);
  if (!challenge) throw new Error("Cannot authorize without MPP challenge.");
  return { headers: mppClient.authorize({ challenge, operationKey, resourceHost: hostOf(url), advertisedAtomic }).header };
}

export function refuseFallback(fromProtocol: ProtocolName, paymentState: string): void {
  if (!canFallbackProtocol(paymentState as never)) {
    throw Object.assign(new Error(`Refusing to retry ${fromProtocol} via another protocol while payment is ${paymentState}.`), {
      code: "fallback_blocked",
    });
  }
}

export function recoveryAction(invocation: InvocationRow) {
  const payment = store.latestPayment(invocation.id);
  return classifyRecovery({
    invocationId: invocation.id,
    operationKey: invocation.operationKey,
    payment: payment?.settlementState ?? "not_started",
    delivery: invocation.deliveryState,
    protocol: payment?.protocol ?? "x402",
  });
}

export { lookupUrl, extractionUrl, pins, allowedHosts };
