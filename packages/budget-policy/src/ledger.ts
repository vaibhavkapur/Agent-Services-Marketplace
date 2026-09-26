import {
  availableBudget,
  id,
  parseAtomic,
  snapshotFromTotals,
  type AssetCode,
  type BudgetEntryType,
  type BudgetSnapshot,
} from "@asm/shared";
import { canReserve } from "./policy.js";

export type JournalEntry = {
  id: string;
  taskId: string;
  entryType: BudgetEntryType;
  amountAtomic: bigint;
  operationRef: string;
  idempotencyKey: string;
};

export type LedgerTask = {
  id: string;
  asset: AssetCode;
  decimals: number;
  budgetAtomic: bigint;
  networkFeeAllowanceAtomic: bigint;
};

type TaskBooks = {
  task: LedgerTask;
  entries: JournalEntry[];
  sessionLocked: bigint;
  sessionConsumed: bigint;
  networkFeeSpent: bigint;
};

export class BudgetLedger {
  private readonly books = new Map<string, TaskBooks>();
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly now = () => Date.now()) {}

  register(task: LedgerTask): void {
    if (!this.books.has(task.id)) {
      this.books.set(task.id, {
        task,
        entries: [],
        sessionLocked: 0n,
        sessionConsumed: 0n,
        networkFeeSpent: 0n,
      });
    }
  }

  snapshot(taskId: string): BudgetSnapshot {
    const books = this.require(taskId);
    return snapshotFromTotals({
      asset: books.task.asset,
      decimals: books.task.decimals,
      budget: books.task.budgetAtomic,
      completed: this.total(books, "commit"),
      reserved: this.activeReservations(books),
      sessionLocked: books.sessionLocked,
      sessionConsumed: books.sessionConsumed,
      networkFeeAllowance: books.task.networkFeeAllowanceAtomic,
      networkFeeSpent: books.networkFeeSpent,
    });
  }

  async withTaskLock<T>(taskId: string, fn: () => Promise<T> | T): Promise<T> {
    const previous = this.locks.get(taskId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(taskId, previous.then(() => current));
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  reserve(input: {
    taskId: string;
    amountAtomic: string | bigint;
    operationRef: string;
    idempotencyKey: string;
  }): JournalEntry {
    const books = this.require(input.taskId);
    const existing = books.entries.find((entry) => entry.idempotencyKey === input.idempotencyKey);
    if (existing) return existing;
    const amount = parseAtomic(input.amountAtomic);
    const remaining = availableBudget({
      budget: books.task.budgetAtomic,
      completed: this.total(books, "commit"),
      reserved: this.activeReservations(books),
    });
    const decision = canReserve(remaining, amount);
    if (!decision.ok) {
      throw Object.assign(new Error(decision.reason), { code: decision.code });
    }
    return this.append(books, {
      entryType: "reserve",
      amountAtomic: amount,
      operationRef: input.operationRef,
      idempotencyKey: input.idempotencyKey,
    });
  }

  commit(input: {
    taskId: string;
    amountAtomic: string | bigint;
    operationRef: string;
    idempotencyKey: string;
  }): JournalEntry {
    const books = this.require(input.taskId);
    const existing = books.entries.find((entry) => entry.idempotencyKey === input.idempotencyKey);
    if (existing) return existing;
    return this.append(books, {
      entryType: "commit",
      amountAtomic: parseAtomic(input.amountAtomic),
      operationRef: input.operationRef,
      idempotencyKey: input.idempotencyKey,
    });
  }

  release(input: {
    taskId: string;
    amountAtomic: string | bigint;
    operationRef: string;
    idempotencyKey: string;
  }): JournalEntry {
    const books = this.require(input.taskId);
    const existing = books.entries.find((entry) => entry.idempotencyKey === input.idempotencyKey);
    if (existing) return existing;
    return this.append(books, {
      entryType: "release",
      amountAtomic: parseAtomic(input.amountAtomic),
      operationRef: input.operationRef,
      idempotencyKey: input.idempotencyKey,
    });
  }

  lockSession(taskId: string, amount: bigint): void {
    this.require(taskId).sessionLocked += amount;
  }

  consumeSession(taskId: string, amount: bigint): void {
    const books = this.require(taskId);
    books.sessionConsumed += amount;
    if (books.sessionConsumed > books.sessionLocked) {
      throw Object.assign(new Error("Session consumption exceeds locked funds."), {
        code: "session_overdraw",
      });
    }
  }

  closeSession(taskId: string, unused: bigint): void {
    const books = this.require(taskId);
    books.sessionLocked -= unused;
    if (books.sessionLocked < books.sessionConsumed) {
      books.sessionLocked = books.sessionConsumed;
    }
  }

  journal(taskId: string): JournalEntry[] {
    return [...this.require(taskId).entries];
  }

  private activeReservations(books: TaskBooks): bigint {
    const reserved = this.total(books, "reserve");
    const released = this.total(books, "release");
    const committed = this.total(books, "commit");
    const active = reserved - released - committed;
    return active > 0n ? active : 0n;
  }

  private total(books: TaskBooks, type: BudgetEntryType): bigint {
    return books.entries
      .filter((entry) => entry.entryType === type)
      .reduce((sum, entry) => sum + entry.amountAtomic, 0n);
  }

  private append(
    books: TaskBooks,
    input: Omit<JournalEntry, "id" | "taskId">,
  ): JournalEntry {
    const entry: JournalEntry = {
      id: id("bj"),
      taskId: books.task.id,
      ...input,
    };
    books.entries.push(entry);
    void this.now;
    return entry;
  }

  private require(taskId: string): TaskBooks {
    const books = this.books.get(taskId);
    if (!books) throw new Error(`Unknown task budget: ${taskId}`);
    return books;
  }
}
