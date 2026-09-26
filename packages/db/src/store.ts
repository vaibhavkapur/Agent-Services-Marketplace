import {
  id,
  type BudgetEntryType,
  type DeliveryState,
  type InvocationState,
  type PaymentState,
  type ProtocolName,
  type ServiceRecord,
  type SessionCloseState,
  type SettlementKind,
  type TaskStatus,
  type UnusedFundsState,
} from "@asm/shared";
import { catalogServices } from "./catalog.js";

export type TaskRow = {
  id: string;
  userId: string;
  goal: string;
  status: TaskStatus;
  supplierIds: string[];
  allowedServices: string[];
  preferredLookupProtocol: ProtocolName;
  budgetAsset: "USDC";
  budgetAtomic: bigint;
  budgetDecimals: number;
  budgetScope: "service_charges";
  feePolicyId: string;
  networkFeeAllowanceAtomic: bigint;
  createdAt: string;
  completedAt?: string;
};

export type InvocationRow = {
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
  createdAt: string;
  lastReconciledAt?: string;
};

export type PaymentRow = {
  id: string;
  invocationId: string;
  protocol: ProtocolName;
  profileVersion: string;
  challengeReference?: string;
  asset: string;
  network: string;
  amountAtomic: bigint;
  authorizationState: PaymentState;
  settlementState: PaymentState;
  settlementKind: SettlementKind;
  receiptReference?: string;
  transactionReference?: string;
  failureReason?: string;
};

export type SessionRow = {
  id: string;
  taskId: string;
  serviceId: string;
  nativeSessionId: string;
  fundedAtomic: bigint;
  authorizedUsageAtomic: bigint;
  settledAtomic: bigint;
  usageSequence: number;
  closeState: SessionCloseState;
  unusedFundsState: UnusedFundsState;
};

export type JournalRow = {
  id: string;
  taskId: string;
  entryType: BudgetEntryType;
  amountAtomic: bigint;
  operationRef: string;
  idempotencyKey: string;
};

export type UsageRow = {
  id: string;
  sessionId: string;
  sequence: number;
  units: number;
  amountAtomic: bigint;
};

export type ResultRow = {
  id: string;
  invocationId: string;
  payload: unknown;
  schemaVersion: string;
  checksum: string;
  provenance: unknown;
};

export type ProtocolEventRow = {
  id: string;
  invocationId?: string;
  sessionId?: string;
  protocol: string;
  stage: string;
  redactedPayload: unknown;
};

export type ReportRow = {
  taskId: string;
  body: unknown;
};

export class MemoryStore {
  readonly users = new Map<string, { id: string; displayName: string }>();
  readonly tasks = new Map<string, TaskRow>();
  readonly services = new Map<string, ServiceRecord>();
  readonly invocations = new Map<string, InvocationRow>();
  readonly payments = new Map<string, PaymentRow>();
  readonly sessions = new Map<string, SessionRow>();
  readonly journal: JournalRow[] = [];
  readonly usage: UsageRow[] = [];
  readonly results = new Map<string, ResultRow>();
  readonly events: ProtocolEventRow[] = [];
  readonly reports = new Map<string, ReportRow>();
  private readonly taskLocks = new Map<string, Promise<void>>();

  constructor(endpoints: { lookup: string; extraction: string }) {
    this.users.set("demo-user", { id: "demo-user", displayName: "Demo researcher" });
    for (const service of catalogServices(endpoints)) {
      this.services.set(service.service_id, service);
    }
  }

  async withTaskLock<T>(taskId: string, fn: () => Promise<T> | T): Promise<T> {
    const previous = this.taskLocks.get(taskId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.taskLocks.set(taskId, previous.then(() => gate));
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  listServices(): ServiceRecord[] {
    return [...this.services.values()];
  }

  getService(idValue: string): ServiceRecord | undefined {
    return this.services.get(idValue);
  }

  createTask(row: TaskRow): TaskRow {
    this.tasks.set(row.id, row);
    return row;
  }

  getTask(idValue: string): TaskRow | undefined {
    return this.tasks.get(idValue);
  }

  listTasks(userId: string): TaskRow[] {
    return [...this.tasks.values()].filter((task) => task.userId === userId);
  }

  updateTask(idValue: string, patch: Partial<TaskRow>): TaskRow {
    const current = this.tasks.get(idValue);
    if (!current) throw new Error("Task not found");
    const next = { ...current, ...patch };
    this.tasks.set(idValue, next);
    return next;
  }

  findInvocationByKey(operationKey: string): InvocationRow | undefined {
    return [...this.invocations.values()].find((row) => row.operationKey === operationKey);
  }

  putInvocation(row: InvocationRow): InvocationRow {
    this.invocations.set(row.id, row);
    return row;
  }

  getInvocation(idValue: string): InvocationRow | undefined {
    return this.invocations.get(idValue);
  }

  listInvocations(taskId: string): InvocationRow[] {
    return [...this.invocations.values()].filter((row) => row.taskId === taskId);
  }

  putPayment(row: PaymentRow): PaymentRow {
    this.payments.set(row.id, row);
    return row;
  }

  listPayments(invocationId: string): PaymentRow[] {
    return [...this.payments.values()].filter((row) => row.invocationId === invocationId);
  }

  latestPayment(invocationId: string): PaymentRow | undefined {
    return this.listPayments(invocationId).at(-1);
  }

  putSession(row: SessionRow): SessionRow {
    this.sessions.set(row.id, row);
    return row;
  }

  getSession(idValue: string): SessionRow | undefined {
    return this.sessions.get(idValue);
  }

  getSessionByNative(nativeSessionId: string): SessionRow | undefined {
    return [...this.sessions.values()].find((row) => row.nativeSessionId === nativeSessionId);
  }

  listSessions(taskId: string): SessionRow[] {
    return [...this.sessions.values()].filter((row) => row.taskId === taskId);
  }

  addJournal(row: Omit<JournalRow, "id"> & { id?: string }): JournalRow {
    const existing = this.journal.find((item) => item.idempotencyKey === row.idempotencyKey);
    if (existing) return existing;
    const created = { ...row, id: row.id ?? id("bj") };
    this.journal.push(created);
    return created;
  }

  listJournal(taskId: string): JournalRow[] {
    return this.journal.filter((row) => row.taskId === taskId);
  }

  addUsage(row: UsageRow): UsageRow {
    const duplicate = this.usage.find((item) => item.id === row.id || (item.sessionId === row.sessionId && item.sequence === row.sequence));
    if (duplicate) return duplicate;
    this.usage.push(row);
    return row;
  }

  listUsage(sessionId: string): UsageRow[] {
    return this.usage.filter((row) => row.sessionId === sessionId);
  }

  putResult(row: ResultRow): ResultRow {
    this.results.set(row.invocationId, row);
    return row;
  }

  getResultByInvocation(invocationId: string): ResultRow | undefined {
    return this.results.get(invocationId);
  }

  addEvent(row: Omit<ProtocolEventRow, "id">): ProtocolEventRow {
    const created = { ...row, id: id("evt") };
    this.events.push(created);
    return created;
  }

  listEvents(invocationId?: string, sessionId?: string): ProtocolEventRow[] {
    return this.events.filter((row) => {
      if (invocationId && row.invocationId === invocationId) return true;
      if (sessionId && row.sessionId === sessionId) return true;
      return false;
    });
  }

  putReport(row: ReportRow): ReportRow {
    this.reports.set(row.taskId, row);
    return row;
  }

  getReport(taskId: string): ReportRow | undefined {
    return this.reports.get(taskId);
  }

  budgetTotals(taskId: string): { reserved: bigint; completed: bigint } {
    const entries = this.listJournal(taskId);
    const reserved = sum(entries, "reserve");
    const released = sum(entries, "release");
    const completed = sum(entries, "commit");
    const active = reserved - released - completed;
    return { reserved: active > 0n ? active : 0n, completed };
  }
}

function sum(entries: JournalRow[], type: BudgetEntryType): bigint {
  return entries.filter((row) => row.entryType === type).reduce((acc, row) => acc + row.amountAtomic, 0n);
}
