import Fastify from "fastify";
import cors from "@fastify/cors";
import { id, parseAtomic, type CreateTaskRequest, type FaultName, type ProtocolName } from "@asm/shared";
import { store, budgetFor, invokeLookup, pins, refuseFallback, recoveryAction } from "./coordinator.js";
import { closeSession, extractPages, openSession, recoverSession } from "./sessions.js";
import { runResearch } from "./agent.js";
import { buildReport } from "./report.js";

const port = Number(process.env.PORT ?? 3001);
const app = Fastify({
  logger: true,
  serializerOpts: {},
});
await app.register(cors, { origin: true });
app.addHook("preSerialization", async (_request, _reply, payload) =>
  JSON.parse(JSON.stringify(payload, (_key, value) => (typeof value === "bigint" ? value.toString() : value))),
);

function userId(headers: Record<string, string | string[] | undefined>): string {
  const value = headers["x-user-id"];
  const raw = Array.isArray(value) ? value[0] : value;
  return raw || pins.demoUserId;
}

function requireTask(idValue: string, owner: string) {
  const task = store.getTask(idValue);
  if (!task) {
    const error = Object.assign(new Error("Task not found"), { statusCode: 404 });
    throw error;
  }
  if (task.userId !== owner) {
    throw Object.assign(new Error("Task belongs to another user"), { statusCode: 403 });
  }
  return task;
}

app.get("/health", async () => ({ ok: true, settlement_mode: pins.settlementMode }));

app.get("/v1/services", async () => store.listServices());

app.post("/v1/tasks", async (request) => {
  const owner = userId(request.headers);
  const body = request.body as CreateTaskRequest;
  const task = store.createTask({
    id: id("task"),
    userId: owner,
    goal: body.goal,
    status: "draft",
    supplierIds: body.supplier_ids,
    allowedServices: body.allowed_services ?? ["supplier_lookup", "document_extraction"],
    preferredLookupProtocol: body.preferred_lookup_protocol ?? "x402",
    budgetAsset: body.budget.asset,
    budgetAtomic: parseAtomic(body.budget.amount_atomic),
    budgetDecimals: body.budget.decimals,
    budgetScope: body.budget.scope,
    feePolicyId: "service-charges-only",
    networkFeeAllowanceAtomic: 100_000n,
    createdAt: new Date().toISOString(),
  });
  return { task, budget: budgetFor(task) };
});

app.get("/v1/tasks", async (request) => {
  return store.listTasks(userId(request.headers)).map((task) => ({
    task,
    budget: budgetFor(task),
  }));
});

app.get("/v1/tasks/:id", async (request) => {
  const task = requireTask((request.params as { id: string }).id, userId(request.headers));
  return {
    task,
    budget: budgetFor(task),
    invocations: store.listInvocations(task.id).map((invocation) => ({
      ...invocation,
      requestDigest: invocation.requestDigest,
      payment: store.latestPayment(invocation.id),
      result: store.getResultByInvocation(invocation.id),
      events: store.listEvents(invocation.id),
    })),
    sessions: store.listSessions(task.id),
    report: store.getReport(task.id)?.body ?? null,
  };
});

app.get("/v1/tasks/:id/budget", async (request) => {
  const task = requireTask((request.params as { id: string }).id, userId(request.headers));
  return budgetFor(task);
});

app.get("/v1/tasks/:id/spending", async (request) => {
  const task = requireTask((request.params as { id: string }).id, userId(request.headers));
  return {
    budget: budgetFor(task),
    journal: store.listJournal(task.id).map((entry) => ({
      ...entry,
      amountAtomic: entry.amountAtomic.toString(),
    })),
  };
});

app.post("/v1/tasks/:id/run", async (request) => {
  const task = requireTask((request.params as { id: string }).id, userId(request.headers));
  const body = (request.body ?? {}) as { fault?: FaultName };
  return runResearch(task.id, body.fault ?? "none");
});

app.post("/v1/tasks/:id/invocations", async (request) => {
  const task = requireTask((request.params as { id: string }).id, userId(request.headers));
  const body = request.body as {
    service_id: "supplier_lookup" | "supplier_diligence";
    supplier_id: string;
    protocol?: ProtocolName;
    fault?: FaultName;
  };
  const invocation = await invokeLookup({
    task,
    serviceId: body.service_id,
    supplierId: body.supplier_id,
    protocol: body.protocol ?? task.preferredLookupProtocol,
    fault: body.fault,
  });
  return {
    invocation,
    payment: store.latestPayment(invocation.id),
    result: store.getResultByInvocation(invocation.id),
    budget: budgetFor(task),
  };
});

app.get("/v1/invocations/:id", async (request, reply) => {
  const owner = userId(request.headers);
  const invocation = store.getInvocation((request.params as { id: string }).id);
  if (!invocation) return reply.code(404).send({ error: "not_found" });
  requireTask(invocation.taskId, owner);
  return {
    invocation,
    payment: store.latestPayment(invocation.id),
    events: store.listEvents(invocation.id),
    recovery: recoveryAction(invocation),
  };
});

app.get("/v1/invocations/:id/result", async (request, reply) => {
  const owner = userId(request.headers);
  const invocation = store.getInvocation((request.params as { id: string }).id);
  if (!invocation) return reply.code(404).send({ error: "not_found" });
  requireTask(invocation.taskId, owner);
  const result = store.getResultByInvocation(invocation.id);
  if (!result) return reply.code(404).send({ error: "result_unavailable" });
  return result;
});

app.post("/v1/tasks/:id/sessions", async (request) => {
  const task = requireTask((request.params as { id: string }).id, userId(request.headers));
  const body = (request.body ?? {}) as { deposit_atomic?: string };
  const session = await openSession(task, body.deposit_atomic);
  return { session, budget: budgetFor(task) };
});

app.post("/v1/sessions/:id/extract", async (request) => {
  const owner = userId(request.headers);
  const session = store.getSession((request.params as { id: string }).id);
  if (!session) throw Object.assign(new Error("Session not found"), { statusCode: 404 });
  const task = requireTask(session.taskId, owner);
  const body = request.body as { document_id: string; page_indexes: number[]; event_id?: string };
  return extractPages({
    task,
    sessionId: session.id,
    documentId: body.document_id,
    pageIndexes: body.page_indexes,
    eventId: body.event_id,
  });
});

app.post("/v1/sessions/:id/close", async (request) => {
  const owner = userId(request.headers);
  const session = store.getSession((request.params as { id: string }).id);
  if (!session) throw Object.assign(new Error("Session not found"), { statusCode: 404 });
  const task = requireTask(session.taskId, owner);
  const body = (request.body ?? {}) as { fault?: string };
  const closed = await closeSession({ task, sessionId: session.id, fault: body.fault });
  return { session: closed, budget: budgetFor(task) };
});

app.post("/v1/sessions/:id/recover", async (request) => {
  const owner = userId(request.headers);
  const session = store.getSession((request.params as { id: string }).id);
  if (!session) throw Object.assign(new Error("Session not found"), { statusCode: 404 });
  requireTask(session.taskId, owner);
  return recoverSession(session.id);
});

app.get("/v1/tasks/:id/report", async (request) => {
  const task = requireTask((request.params as { id: string }).id, userId(request.headers));
  return store.getReport(task.id)?.body ?? buildReport(task, budgetFor(task));
});

app.post("/v1/policy/fallback", async (request, reply) => {
  const body = request.body as { protocol: ProtocolName; payment_state: string };
  try {
    refuseFallback(body.protocol, body.payment_state);
    return { allowed: true };
  } catch (error) {
    return reply.code(409).send({ allowed: false, error: error instanceof Error ? error.message : "blocked" });
  }
});

await app.listen({ port, host: "0.0.0.0" });
