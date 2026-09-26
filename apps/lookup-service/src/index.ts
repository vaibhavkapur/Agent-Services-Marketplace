import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadPins } from "@asm/shared";
import { MppChargeServer, MPP_HEADERS } from "@asm/mpp-adapter";
import { X402ResourceServer, X402_HEADERS } from "@asm/x402-adapter";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const suppliers = JSON.parse(readFileSync(resolve(root, "fixtures/suppliers.json"), "utf8")) as Array<
  Record<string, unknown> & { id: string }
>;
const pins = loadPins();
const x402 = new X402ResourceServer(pins);
const mpp = new MppChargeServer(pins);
const challenges = new Map<string, ReturnType<MppChargeServer["challenge"]>>();
const byOperation = new Map<string, { result: unknown; protocol: string }>();

const LOOKUP_PRICE = process.env.LOOKUP_PRICE ?? "20000";
const DILIGENCE_PRICE = process.env.DILIGENCE_PRICE ?? "1950000";
const port = Number(process.env.PORT ?? 3002);

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, exposedHeaders: [X402_HEADERS.required, X402_HEADERS.response, MPP_HEADERS.challenge, MPP_HEADERS.receipt] });

app.get("/health", async () => ({ ok: true, service: "lookup" }));

app.get("/v1/suppliers/:supplierId", async (request, reply) => {
  return paidLookup(request, reply, LOOKUP_PRICE, "supplier.lookup");
});

app.get("/v1/diligence/:supplierId", async (request, reply) => {
  return paidLookup(request, reply, DILIGENCE_PRICE, "supplier.diligence");
});

app.get("/v1/operations/:operationKey", async (request, reply) => {
  const { operationKey } = request.params as { operationKey: string };
  const stored = byOperation.get(operationKey);
  if (!stored) return reply.code(404).send({ error: "unknown_operation" });
  return stored;
});

async function paidLookup(
  request: { params: unknown; headers: Record<string, string | string[] | undefined>; url: string },
  reply: { code: (n: number) => { headers: (h: Record<string, string>) => { send: (b: unknown) => unknown } }; headers: (h: Record<string, string>) => { send: (b: unknown) => unknown } },
  amount: string,
  capability: string,
) {
  const { supplierId } = request.params as { supplierId: string };
  const supplier = suppliers.find((item) => item.id === supplierId);
  if (!supplier) return reply.code(404).send({ error: "unknown_supplier" });
  const profile = String(request.headers["x-payment-profile"] ?? "x402-exact");
  const operationKey = String(request.headers["x-operation-key"] ?? "");
  const fault = String(request.headers["x-demo-fault"] ?? "none");
  const quotedAmount = fault === "higher-price" ? String(BigInt(amount) + 50000n) : amount;
  const host = `localhost:${port}`;
  const resource = `http://${host}${request.url}`;

  if (fault === "unsupported-asset") {
    return reply.code(402).headers({
      [X402_HEADERS.required]: Buffer.from(JSON.stringify({
        x402Version: 2,
        error: "unsupported asset",
        resource: { url: resource, description: capability, mimeType: "application/json" },
        accepts: [{ scheme: "exact", network: pins.x402.network, amount: quotedAmount, asset: "0xdead", payTo: pins.payeeAddress, maxTimeoutSeconds: 60, extra: { name: "FAKE", version: "2" } }],
        extensions: {},
      }), "utf8").toString("base64"),
    }).send({ error: "payment_required" });
  }

  const result = {
    capability,
    supplier,
    schema_version: capability === "supplier.diligence" ? "diligence-memo-v1" : "supplier-profile-v1",
    generated_at: "2026-09-25T00:00:00.000Z",
  };

  if (operationKey && byOperation.has(operationKey)) {
    return byOperation.get(operationKey);
  }

  if (profile === "mpp-charge") {
    const credential = String(request.headers[MPP_HEADERS.credential.toLowerCase()] ?? "");
    if (!credential) {
      const challenge = mpp.challenge({ amountAtomic: quotedAmount, resource });
      challenges.set(challenge.challengeId, challenge);
      return reply.code(402).headers(mpp.challengeHeaders(challenge)).send({ error: "payment_required", protocol: "mpp" });
    }
    const parsed = mpp.parseCredential(credential);
    const challenge = parsed ? challenges.get(parsed.challengeId) : undefined;
    if (!parsed || !challenge) return reply.code(402).send({ error: "unknown_challenge" });
    const verified = mpp.verify({ challenge, credential: parsed, expectedAmount: quotedAmount });
    if (!verified.ok) return reply.code(402).send({ error: verified.reason });
    const settled = mpp.settle({ challenge, result });
    if (operationKey) byOperation.set(operationKey, { result, protocol: "mpp" });
    if (fault === "drop-after-payment") {
      return reply.code(504).headers(mpp.receiptHeaders(settled.receipt)).send({ error: "delivery_timeout" });
    }
    return reply.headers(mpp.receiptHeaders(settled.receipt)).send({
      result,
      receipt: settled.receipt,
      replay: settled.replay,
    });
  }

  const signature = String(request.headers[X402_HEADERS.signature.toLowerCase()] ?? "");
  const required = x402.accept({
    amountAtomic: quotedAmount,
    resourceUrl: resource,
    description: capability,
  });
  if (fault === "expired-terms") {
    required.accepts[0]!.maxTimeoutSeconds = 0;
  }
  if (!signature) {
    return reply.code(402).headers(x402.requiredHeaders(required)).send({ error: "payment_required", protocol: "x402" });
  }
  const payload = x402.parsePayload(signature);
  if (!payload) return reply.code(402).send({ error: "invalid_payload" });
  const verified = x402.verify({ payload, expectedAmount: quotedAmount, expectedResource: resource, operationKey });
  if (!verified.ok) return reply.code(402).send({ error: verified.reason });
  const existing = x402.recall(verified.paymentId);
  const settled = existing
    ? { settlement: existing.settlement, replay: true, result: existing.result }
    : { ...x402.settle({ paymentId: verified.paymentId, operationKey: verified.operationKey, result }), result };
  if (operationKey) byOperation.set(operationKey, { result, protocol: "x402" });
  if (fault === "drop-after-payment" && !settled.replay) {
    return reply.code(504).headers(x402.responseHeaders(settled.settlement)).send({ error: "delivery_timeout" });
  }
  return reply.headers(x402.responseHeaders(settled.settlement)).send({
    result: settled.result,
    settlement: settled.settlement,
    replay: settled.replay,
  });
}

await app.listen({ port, host: "0.0.0.0" });
