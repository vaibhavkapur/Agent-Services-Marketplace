import { describe, expect, it } from "vitest";
import { classifyRecovery, reconcileUsage } from "@asm/reconciliation";
import { isPaidButUndelivered } from "@asm/invocation-domain";

describe("paid delivery recovery", () => {
  it("keeps financial state when settlement succeeded but delivery timed out", () => {
    expect(isPaidButUndelivered({ payment: "settled", delivery: "outcome_unknown" })).toBe(true);
    expect(
      classifyRecovery({
        invocationId: "inv",
        operationKey: "op",
        payment: "settled",
        delivery: "outcome_unknown",
        protocol: "x402",
      }),
    ).toBe("result_lookup");
  });

  it("keeps funds reserved when settlement is unknown", () => {
    expect(
      classifyRecovery({
        invocationId: "inv",
        operationKey: "op",
        payment: "outcome_unknown",
        delivery: "processing",
        protocol: "mpp",
      }),
    ).toBe("keep_reserved");
  });
});

describe("usage reconciliation", () => {
  it("deduplicates usage events before summing authorized consumption", () => {
    const result = reconcileUsage([
      { eventId: "a", amountAtomic: 10_000n, sequence: 2 },
      { eventId: "a", amountAtomic: 10_000n, sequence: 2 },
      { eventId: "b", amountAtomic: 10_000n, sequence: 1 },
    ]);
    expect(result.uniqueEvents).toBe(2);
    expect(result.authorizedAtomic).toBe(20_000n);
  });
});
