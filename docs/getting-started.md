# Getting Started

[Documentation home](index.md)

## Prerequisites

Use Node.js 22 (the container runtime), pnpm 10.15.0 (the repository's `packageManager` pin), and Git. Docker Compose is optional. No funded wallet or external payment account is needed for the simulated demo.

## Clone and run

```bash
git clone https://github.com/vaibhavkapur/Agent-Services-Marketplace.git
cd Agent-Services-Marketplace
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` starts the API (`3001`), lookup service (`3002`), extraction service (`3003`), MCP catalog (`3004`), and Next.js UI (`3000`). Open [the UI](http://localhost:3000), or run `curl http://localhost:3001/health`. Wait for all services to listen before starting a task.

Default settings are sufficient. If overriding them, export variables in the shell; the Node services read `process.env` and do not automatically load the root `.env.example`. Keep `SETTLEMENT_MODE=simulated`.

## First research task

```bash
curl -X POST http://localhost:3001/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"goal":"Find suppliers for 27-inch monitors","supplier_ids":["s1","s2","s3","s4","s5"],"preferred_lookup_protocol":"x402","budget":{"asset":"USDC","amount_atomic":"2000000","decimals":6,"scope":"service_charges"}}'
```

Copy `task.id` from the response and replace `TASK_ID` below:

```bash
curl -X POST http://localhost:3001/v1/tasks/TASK_ID/run \
  -H "Content-Type: application/json" -d '{}'
curl http://localhost:3001/v1/tasks/TASK_ID/report
curl http://localhost:3001/v1/tasks/TASK_ID/spending
```

The loop performs five supplier lookups and extracts pages from up to two fixture documents. Inspect purchased sources, receipts, consumed spend, and retained reservations. A task's `completed` status is not evidence that every payment or session has reconciled.

## Verify and continue

```bash
pnpm typecheck
pnpm test
```

See [Demos A–D](DEMO.md) for budget refusal, lost responses, and interrupted session close. [Database](database.md) explains why starting PostgreSQL does not make the current API state durable. [Deployment](deployment.md) covers Compose.
