import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadPins } from "@asm/shared";
import { MppSessionServer, MPP_HEADERS, type MppVoucher } from "@asm/mpp-adapter";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const documents = JSON.parse(readFileSync(resolve(root, "fixtures/documents.json"), "utf8")) as Record<
  string,
  { document_id: string; supplier_id: string; title: string; pages: string[] }
>;
const pins = loadPins();
const unitPrice = 10_000n;
const sessions = new MppSessionServer(pins, unitPrice);
const port = Number(process.env.PORT ?? 3003);
const app = Fastify({ logger: true });
await app.register(cors, { origin: true, exposedHeaders: [MPP_HEADERS.session, MPP_HEADERS.receipt] });

app.get("/health", async () => ({ ok: true, service: "extraction" }));

app.post("/v1/sessions", async (request, reply) => {
  const body = (request.body ?? {}) as { suggested_deposit_atomic?: string };
  const challenge = sessions.open({
    suggestedDeposit: body.suggested_deposit_atomic ?? "50000",
    resource: `http://localhost:${port}/v1/documents`,
  });
  return reply.headers(sessions.challengeHeaders(challenge)).send(challenge);
});

app.post("/v1/sessions/:sessionId/fund", async (request) => {
  const { sessionId } = request.params as { sessionId: string };
  const body = request.body as { amount_atomic: string };
  const session = sessions.fund(sessionId, BigInt(body.amount_atomic));
  return {
    session_id: session.sessionId,
    funded_atomic: session.fundedAtomic.toString(),
  };
});

app.post("/v1/documents/:documentId/pages", async (request, reply) => {
  const { documentId } = request.params as { documentId: string };
  const doc = documents[documentId];
  if (!doc) return reply.code(404).send({ error: "unknown_document" });
  const body = request.body as { session_id: string; page_indexes: number[]; voucher: MppVoucher };
  const accepted = sessions.acceptVoucher(body.voucher);
  const pages = body.page_indexes
    .map((index) => ({ index, text: doc.pages[index] }))
    .filter((page) => page.text);
  return {
    document: { id: doc.document_id, title: doc.title, supplier_id: doc.supplier_id },
    pages,
    duplicate: accepted.duplicate,
    authorized_usage_atomic: accepted.session.authorizedUsageAtomic.toString(),
    usage_sequence: accepted.session.usageSequence,
  };
});

app.post("/v1/sessions/:sessionId/close", async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const fault = String(request.headers["x-demo-fault"] ?? "none");
  if (fault === "interrupt-session") {
    const interrupted = sessions.interruptClose(sessionId);
    return reply.code(504).send({
      error: "close_interrupted",
      session_id: interrupted.sessionId,
      close_state: interrupted.closeState,
      unused_funds_state: interrupted.unusedFundsState,
    });
  }
  sessions.beginClose(sessionId);
  return sessions.close(sessionId);
});

app.get("/v1/sessions/:sessionId", async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const session = sessions.get(sessionId);
  if (!session) return reply.code(404).send({ error: "unknown_session" });
  return {
    ...session,
    fundedAtomic: session.fundedAtomic.toString(),
    authorizedUsageAtomic: session.authorizedUsageAtomic.toString(),
    settledAtomic: session.settledAtomic.toString(),
    seenEvents: [...session.seenEvents],
  };
});

await app.listen({ port, host: "0.0.0.0" });
