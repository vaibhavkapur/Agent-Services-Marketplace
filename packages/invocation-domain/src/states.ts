import type { DeliveryState, InvocationState, PaymentState } from "@asm/shared";

const INVOCATION: Record<InvocationState, InvocationState[]> = {
  created: ["quoted", "rejected"],
  quoted: ["budget_reserved", "rejected"],
  budget_reserved: ["authorizing", "rejected"],
  authorizing: ["requesting", "recovery_required", "rejected"],
  requesting: ["completed", "recovery_required", "rejected"],
  completed: [],
  recovery_required: ["completed", "rejected"],
  rejected: [],
};

const PAYMENT: Record<PaymentState, PaymentState[]> = {
  not_started: ["authorized"],
  authorized: ["settlement_pending"],
  settlement_pending: ["settled", "failed", "outcome_unknown"],
  settled: [],
  failed: [],
  outcome_unknown: ["settled", "failed"],
};

const DELIVERY: Record<DeliveryState, DeliveryState[]> = {
  not_started: ["processing"],
  processing: ["available", "failed", "outcome_unknown"],
  available: ["retrieved"],
  retrieved: [],
  failed: [],
  outcome_unknown: ["available", "failed"],
};

export function transition<T extends string>(
  graph: Record<T, T[]>,
  from: T,
  to: T,
): T {
  if (from === to) return from;
  if (!graph[from].includes(to)) {
    throw new Error(`Illegal state transition ${from} → ${to}`);
  }
  return to;
}

export const transitionInvocation = (from: InvocationState, to: InvocationState) =>
  transition(INVOCATION, from, to);
export const transitionPayment = (from: PaymentState, to: PaymentState) =>
  transition(PAYMENT, from, to);
export const transitionDelivery = (from: DeliveryState, to: DeliveryState) =>
  transition(DELIVERY, from, to);

export function isPaidButUndelivered(input: {
  payment: PaymentState;
  delivery: DeliveryState;
}): boolean {
  return input.payment === "settled" && input.delivery !== "available" && input.delivery !== "retrieved";
}

export function canFallbackProtocol(payment: PaymentState): boolean {
  return payment === "not_started" || payment === "failed";
}
