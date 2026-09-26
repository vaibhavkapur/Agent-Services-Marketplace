import { isPaidButUndelivered } from "@asm/invocation-domain";
import type { DeliveryState, PaymentState } from "@asm/shared";

export type Recoverable = {
  invocationId: string;
  operationKey: string;
  payment: PaymentState;
  delivery: DeliveryState;
  protocol: string;
};

export function classifyRecovery(item: Recoverable): "result_lookup" | "keep_reserved" | "none" {
  if (isPaidButUndelivered(item)) return "result_lookup";
  if (item.payment === "outcome_unknown" || item.payment === "settlement_pending") {
    return "keep_reserved";
  }
  return "none";
}

export function reconcileUsage(events: Array<{ eventId: string; amountAtomic: bigint; sequence: number }>): {
  uniqueEvents: number;
  authorizedAtomic: bigint;
} {
  const seen = new Set<string>();
  let authorized = 0n;
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  for (const event of ordered) {
    if (seen.has(event.eventId)) continue;
    seen.add(event.eventId);
    authorized += event.amountAtomic;
  }
  return { uniqueEvents: seen.size, authorizedAtomic: authorized };
}
