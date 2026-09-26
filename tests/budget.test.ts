import { describe, expect, it } from "vitest";
import { BudgetLedger } from "@asm/budget-policy";
import { availableBudget, TWO_DOLLARS_ATOMIC } from "@asm/shared";

function ledger() {
  const books = new BudgetLedger();
  books.register({
    id: "task_1",
    asset: "USDC",
    decimals: 6,
    budgetAtomic: TWO_DOLLARS_ATOMIC,
    networkFeeAllowanceAtomic: 100_000n,
  });
  return books;
}

describe("budget arithmetic", () => {
  it("computes available as budget - completed - reserved", () => {
    expect(availableBudget({ budget: 2_000_000n, completed: 200_000n, reserved: 50_000n })).toBe(1_750_000n);
  });

  it("refuses a reservation that would overspend", () => {
    const books = ledger();
    books.reserve({
      taskId: "task_1",
      amountAtomic: 1_800_000n,
      operationRef: "a",
      idempotencyKey: "reserve:a",
    });
    expect(() =>
      books.reserve({
        taskId: "task_1",
        amountAtomic: 300_000n,
        operationRef: "b",
        idempotencyKey: "reserve:b",
      }),
    ).toThrow(/remaining task allowance/i);
  });

  it("does not treat session deposit and its consumption as two expenses", () => {
    const books = ledger();
    books.reserve({
      taskId: "task_1",
      amountAtomic: 40_000n,
      operationRef: "session:1",
      idempotencyKey: "reserve:session:1",
    });
    books.lockSession("task_1", 40_000n);
    books.consumeSession("task_1", 20_000n);
    const snap = books.snapshot("task_1");
    expect(snap.reserved_atomic).toBe("40000");
    expect(snap.session_locked_atomic).toBe("40000");
    expect(snap.session_consumed_atomic).toBe("20000");
    expect(snap.completed_spend_atomic).toBe("0");
  });
});

describe("concurrent reservations", () => {
  it("serializes two tools against the same task budget", async () => {
    const books = ledger();
    const results = await Promise.allSettled([
      books.withTaskLock("task_1", async () =>
        books.reserve({
          taskId: "task_1",
          amountAtomic: 1_200_000n,
          operationRef: "one",
          idempotencyKey: "reserve:one",
        }),
      ),
      books.withTaskLock("task_1", async () =>
        books.reserve({
          taskId: "task_1",
          amountAtomic: 1_200_000n,
          operationRef: "two",
          idempotencyKey: "reserve:two",
        }),
      ),
    ]);
    const fulfilled = results.filter((item) => item.status === "fulfilled");
    const rejected = results.filter((item) => item.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it("replays the same journal identity instead of reserving twice", () => {
    const books = ledger();
    const first = books.reserve({
      taskId: "task_1",
      amountAtomic: 20_000n,
      operationRef: "op",
      idempotencyKey: "reserve:op",
    });
    const second = books.reserve({
      taskId: "task_1",
      amountAtomic: 20_000n,
      operationRef: "op",
      idempotencyKey: "reserve:op",
    });
    expect(first.id).toBe(second.id);
    expect(books.snapshot("task_1").reserved_atomic).toBe("20000");
  });
});
