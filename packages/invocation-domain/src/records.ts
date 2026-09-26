import {
  digestJson,
  id,
  operationKey,
  type DeliveryState,
  type InvocationState,
  type PaymentState,
  type ProtocolName,
  type SettlementKind,
} from "@asm/shared";

export type InvocationRecord = {
  id: string;
  taskId: string;
  serviceId: string;
  operationKey: string;
  requestDigest: string;
  requestPayload: unknown;
  invocationState: InvocationState;
  deliveryState: DeliveryState;
  resultReference?: string;
  lastError?: string;
};

export type PaymentAttemptRecord = {
  id: string;
  invocationId: string;
  protocol: ProtocolName;
  profileVersion: string;
  challengeReference?: string;
  asset: string;
  network: string;
  amountAtomic: string;
  authorizationState: PaymentState;
  settlementState: PaymentState;
  settlementKind: SettlementKind;
  receiptReference?: string;
  transactionReference?: string;
  failureReason?: string;
};

export function createInvocation(input: {
  taskId: string;
  serviceId: string;
  businessKey: string;
  payload: unknown;
}): InvocationRecord {
  return {
    id: id("inv"),
    taskId: input.taskId,
    serviceId: input.serviceId,
    operationKey: operationKey({
      taskId: input.taskId,
      serviceId: input.serviceId,
      businessKey: input.businessKey,
    }),
    requestDigest: digestJson(input.payload),
    requestPayload: input.payload,
    invocationState: "created",
    deliveryState: "not_started",
  };
}

export function createPaymentAttempt(input: {
  invocationId: string;
  protocol: ProtocolName;
  profileVersion: string;
  asset: string;
  network: string;
  amountAtomic: string;
  settlementKind: SettlementKind;
}): PaymentAttemptRecord {
  return {
    id: id("pay"),
    invocationId: input.invocationId,
    protocol: input.protocol,
    profileVersion: input.profileVersion,
    asset: input.asset,
    network: input.network,
    amountAtomic: input.amountAtomic,
    authorizationState: "not_started",
    settlementState: "not_started",
    settlementKind: input.settlementKind,
  };
}
