# Agent Services Marketplace

A research-service demo with an MCP-style catalog, local x402 V2 exact and MPP charge/session fixtures, and separate accounting for spending, delivery, and settlement. The default research loop calls the invocation coordinator directly.

> **[Read the full documentation](docs/index.md)**

Built with TypeScript, Fastify, and Next.js. The current runtime uses in-memory storage and local payment fixtures.

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the API, paid suppliers, extraction service, MCP catalog, and UI
pnpm --filter @asm/lookup-service --filter @asm/extraction-service --filter @asm/api --filter @asm/catalog-mcp --filter @asm/web --parallel dev
```

Open http://localhost:3000 and run Demo A. Optional Postgres/Redis: `docker compose up postgres redis`.

Default settlement is **simulated**. Receipt views label it explicitly. The current `testnet` setting does not broadcast transactions; see [implementation limits](docs/PINS.md#implementation-status).

See [Getting Started](docs/getting-started.md) for prerequisites, cloning, configuration, and verification.

## Quick Example

```bash
# Create a $2 USDC service-charge research task
curl -X POST http://localhost:3001/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Find suppliers for 27-inch monitors",
    "supplier_ids": ["s1", "s2", "s3", "s4", "s5"],
    "preferred_lookup_protocol": "x402",
    "budget": {
      "asset": "USDC",
      "amount_atomic": "2000000",
      "decimals": 6,
      "scope": "service_charges"
    }
  }'

# Run the research loop (five lookups + document extraction)
curl -X POST http://localhost:3001/v1/tasks/task_.../run \
  -H "Content-Type: application/json" \
  -d '{}'

# Inspect spend and purchased sources
curl http://localhost:3001/v1/tasks/task_.../report
```

Replace `task_...` with `task.id` from the create response. The budget covers service charges in the fixture, not a funded wallet or live network fees.
