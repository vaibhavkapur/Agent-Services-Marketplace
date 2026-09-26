const mcpUrl = process.env.MCP_URL ?? "http://localhost:3004";
const apiUrl = process.env.API_URL ?? "http://localhost:3001";

async function mcp(method: string, params?: Record<string, unknown>) {
  const response = await fetch(`${mcpUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  return response.json() as Promise<{ result?: { structuredContent?: unknown }; error?: { message: string } }>;
}

async function call(name: string, args: Record<string, unknown>) {
  const message = await mcp("tools/call", { name, arguments: args });
  if (message.error) throw new Error(message.error.message);
  return message.result?.structuredContent;
}

export async function runViaMcp(taskId: string) {
  const discovered = await call("search_services", { capability: "supplier" });
  const budget = await call("get_task_budget", { task_id: taskId });
  return { discovered, budget };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("index.ts")) {
  const taskId = process.argv[2];
  if (!taskId) {
    console.log("usage: pnpm --filter @asm/research-agent dev <taskId>");
    console.log(`API ${apiUrl} MCP ${mcpUrl}`);
    process.exit(0);
  }
  console.log(JSON.stringify(await runViaMcp(taskId), null, 2));
}
