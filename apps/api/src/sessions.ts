import { id, parseAtomic } from "@asm/shared";
import { MppSessionClient } from "@asm/mpp-adapter";
import { PAGE_PRICE, type TaskRow } from "@asm/db";
import { store, extractionUrl, pins, budgetFor } from "./coordinator.js";
import { requestJson } from "./http.js";

const client = new MppSessionClient(pins);

export async function openSession(task: TaskRow, depositAtomic = "50000") {
  const remaining = parseAtomic(budgetFor(task).available_atomic);
  const deposit = parseAtomic(depositAtomic);
  if (deposit > remaining) {
    throw Object.assign(new Error("Session deposit exceeds remaining task budget."), {
      code: "insufficient_budget",
    });
  }
  const opened = await requestJson({
    url: `${extractionUrl}/v1/sessions`,
    method: "POST",
    body: { suggested_deposit_atomic: depositAtomic },
  });
  const challenge = opened.json as { sessionId: string };
  await requestJson({
    url: `${extractionUrl}/v1/sessions/${challenge.sessionId}/fund`,
    method: "POST",
    body: { amount_atomic: depositAtomic },
  });
  store.addJournal({
    taskId: task.id,
    entryType: "reserve",
    amountAtomic: deposit,
    operationRef: `session:${challenge.sessionId}`,
    idempotencyKey: `reserve:session:${challenge.sessionId}`,
  });
  return store.putSession({
    id: id("sess"),
    taskId: task.id,
    serviceId: "document_extraction",
    nativeSessionId: challenge.sessionId,
    fundedAtomic: deposit,
    authorizedUsageAtomic: 0n,
    settledAtomic: 0n,
    usageSequence: 0,
    closeState: "open",
    unusedFundsState: "held",
  });
}

export async function extractPages(input: {
  task: TaskRow;
  sessionId: string;
  documentId: string;
  pageIndexes: number[];
  eventId?: string;
}) {
  const session = store.getSession(input.sessionId);
  if (!session || session.taskId !== input.task.id) throw new Error("Unknown session");
  const units = input.pageIndexes.length;
  const amount = BigInt(PAGE_PRICE) * BigInt(units);
  const sequence = session.usageSequence + 1;
  const voucher = client.voucher({
    sessionId: session.nativeSessionId,
    sequence,
    cumulativeAtomic: session.authorizedUsageAtomic + amount,
    units,
    eventId: input.eventId,
  });
  const response = await requestJson({
    url: `${extractionUrl}/v1/documents/${input.documentId}/pages`,
    method: "POST",
    body: {
      session_id: session.nativeSessionId,
      page_indexes: input.pageIndexes,
      voucher,
    },
  });
  const body = response.json as {
    pages: unknown;
    duplicate?: boolean;
    authorized_usage_atomic: string;
    usage_sequence: number;
  };
  store.addUsage({
    id: voucher.eventId,
    sessionId: session.id,
    sequence,
    units,
    amountAtomic: amount,
  });
  if (!body.duplicate) {
    session.authorizedUsageAtomic = parseAtomic(body.authorized_usage_atomic);
    session.usageSequence = body.usage_sequence;
    store.putSession(session);
  }
  store.addEvent({
    sessionId: session.id,
    protocol: "mpp",
    stage: "usage",
    redactedPayload: { documentId: input.documentId, units, duplicate: body.duplicate },
  });
  return { session, pages: body.pages, duplicate: Boolean(body.duplicate) };
}

export async function closeSession(input: {
  task: TaskRow;
  sessionId: string;
  fault?: string;
}) {
  const session = store.getSession(input.sessionId);
  if (!session) throw new Error("Unknown session");
  session.closeState = "closing";
  store.putSession(session);
  const response = await requestJson({
    url: `${extractionUrl}/v1/sessions/${session.nativeSessionId}/close`,
    method: "POST",
    headers: input.fault ? { "x-demo-fault": input.fault } : undefined,
  });
  if (response.status >= 500) {
    session.closeState = "close_interrupted";
    session.unusedFundsState = "unknown";
    store.putSession(session);
    return recoverSession(session.id);
  }
  const receipt = response.json as {
    settledAtomic?: string;
    unusedAtomic?: string;
    closeState?: "closed";
    unusedFundsState?: "returned";
  };
  if (!receipt.settledAtomic) {
    throw new Error(`Session close returned no settlement: ${JSON.stringify(receipt)}`);
  }
  return applyClose(session.id, {
    settledAtomic: receipt.settledAtomic,
    unusedAtomic: receipt.unusedAtomic ?? "0",
    closeState: "closed",
    unusedFundsState: receipt.unusedFundsState ?? "returned",
  });
}

export async function recoverSession(sessionId: string) {
  const session = store.getSession(sessionId);
  if (!session) throw new Error("Unknown session");
  const remote = await requestJson({
    url: `${extractionUrl}/v1/sessions/${session.nativeSessionId}`,
  });
  const body = remote.json as {
    closeState: string;
    authorizedUsageAtomic: string;
    fundedAtomic: string;
  };
  if (body.closeState === "open" || body.closeState === "close_interrupted" || body.closeState === "closing") {
    const closed = await requestJson({
      url: `${extractionUrl}/v1/sessions/${session.nativeSessionId}/close`,
      method: "POST",
    });
    if (closed.status === 200) {
      return applyClose(session.id, closed.json as {
        settledAtomic: string;
        unusedAtomic: string;
        closeState: "closed";
        unusedFundsState: "returned";
      });
    }
  }
  return session;
}

function applyClose(sessionId: string, receipt: {
  settledAtomic: string;
  unusedAtomic: string;
  closeState: "closed";
  unusedFundsState: "returned";
}) {
  const session = store.getSession(sessionId);
  if (!session) throw new Error("Unknown session");
  session.settledAtomic = parseAtomic(receipt.settledAtomic);
  session.closeState = "reconciled";
  session.unusedFundsState = receipt.unusedFundsState;
  store.putSession(session);
  if (session.settledAtomic > 0n) {
    store.addJournal({
      taskId: session.taskId,
      entryType: "commit",
      amountAtomic: session.settledAtomic,
      operationRef: `session:${session.nativeSessionId}`,
      idempotencyKey: `commit:session:${session.nativeSessionId}`,
    });
  }
  const unused = parseAtomic(receipt.unusedAtomic);
  if (unused > 0n) {
    store.addJournal({
      taskId: session.taskId,
      entryType: "release",
      amountAtomic: unused,
      operationRef: `session:${session.nativeSessionId}`,
      idempotencyKey: `release:session:${session.nativeSessionId}`,
    });
  }
  return session;
}
