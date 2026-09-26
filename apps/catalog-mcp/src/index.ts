import Fastify from "fastify";
import cors from "@fastify/cors";

const apiUrl = process.env.API_URL ?? "http://localhost:3001";
const port = Number(process.env.PORT ?? 3004);

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const tools: Tool[] = [
  {
    name: "search_services",
    description: "Discover marketplace services by capability. Discovery does not authorize spending.",
    inputSchema: {
      type: "object",
      properties: { capability: { type: "string" } },
      required: ["capability"],
    },
  },
  {
    name: "inspect_service",
    description: "Inspect a catalog entry, advertised price, and payment profiles.",
    inputSchema: {
      type: "object",
      properties: { service_id: { type: "string" } },
      required: ["service_id"],
    },
  },
  {
    name: "get_task_budget",
    description: "Read remaining, reserved, and consumed service-charge budget for a task.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
  },
  {
    name: "lookup_supplier",
    description: "Purchase a supplier profile through the invocation coordinator. Never accepts keys or payee addresses.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        supplier_id: { type: "string" },
        protocol: { type: "string", enum: ["x402", "mpp"] },
      },
      required: ["task_id", "supplier_id"],
    },
  },
  {
    name: "extract_document",
    description: "Meter pages from a document against an existing or newly opened MPP session.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        document_id: { type: "string" },
        session_id: { type: "string" },
        page_indexes: { type: "array", items: { type: "number" } },
      },
      required: ["task_id", "document_id"],
    },
  },
  {
    name: "get_paid_result",
    description: "Retrieve a previously purchased result by invocation id without creating a new charge.",
    inputSchema: {
      type: "object",
      properties: { invocation_id: { type: "string" } },
      required: ["invocation_id"],
    },
  },
];

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true, binding: "mcp-tools-over-project-http" }));

app.get("/mcp/tools", async () => ({ tools }));

app.post("/mcp", async (request, reply) => {
  const message = request.body as {
    jsonrpc: "2.0";
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
  };
  if (message.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2026-07-28",
        serverInfo: { name: "asm-catalog-mcp", version: "0.1.0" },
        capabilities: { tools: {} },
      },
    };
  }
  if (message.method === "tools/list") {
    return { jsonrpc: "2.0", id: message.id, result: { tools } };
  }
  if (message.method === "tools/call") {
    const name = String(message.params?.name ?? "");
    const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
    try {
      const result = await callTool(name, args);
      return {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        },
      };
    } catch (error) {
      return reply.send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32000, message: error instanceof Error ? error.message : "tool failed" },
      });
    }
  }
  return reply.code(400).send({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Unknown method" } });
});

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === "search_services") {
    const services = (await api("/v1/services")) as Array<{ capability: string }>;
    const capability = String(args.capability ?? "");
    return services.filter((service) => service.capability.includes(capability));
  }
  if (name === "inspect_service") {
    const services = (await api("/v1/services")) as Array<{ service_id: string }>;
    return services.find((service) => service.service_id === args.service_id) ?? null;
  }
  if (name === "get_task_budget") {
    return api(`/v1/tasks/${args.task_id}/budget`);
  }
  if (name === "lookup_supplier") {
    return api(`/v1/tasks/${args.task_id}/invocations`, {
      method: "POST",
      body: {
        service_id: "supplier_lookup",
        supplier_id: args.supplier_id,
        protocol: args.protocol,
      },
    });
  }
  if (name === "extract_document") {
    let sessionId = args.session_id as string | undefined;
    if (!sessionId) {
      const opened = (await api(`/v1/tasks/${args.task_id}/sessions`, {
        method: "POST",
        body: { deposit_atomic: "40000" },
      })) as { session: { id: string } };
      sessionId = opened.session.id;
    }
    return api(`/v1/sessions/${sessionId}/extract`, {
      method: "POST",
      body: {
        document_id: args.document_id,
        page_indexes: args.page_indexes ?? [0],
      },
    });
  }
  if (name === "get_paid_result") {
    return api(`/v1/invocations/${args.invocation_id}/result`);
  }
  throw new Error(`Unknown tool ${name}`);
}

async function api(path: string, init?: { method?: string; body?: unknown }) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", "x-user-id": "demo-user" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(json));
  return json;
}

await app.listen({ port, host: "0.0.0.0" });
