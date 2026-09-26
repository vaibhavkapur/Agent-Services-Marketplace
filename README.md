# Agent Services Marketplace

A research agent that discovers owned services over MCP, pays with x402 V2 exact or MPP charge/session, and keeps spending, delivery, and settlement independently accountable.

> **[Read the full documentation](docs/DEMO.md)**

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the API, paid suppliers, extraction service, MCP catalog, and UI
pnpm --filter @asm/lookup-service --filter @asm/extraction-service --filter @asm/api --filter @asm/catalog-mcp --filter @asm/web --parallel dev
```

Open http://localhost:3000 and run Demo A. Optional Postgres/Redis: `docker compose up postgres redis`.

Default settlement is **simulated**. Receipts are labeled `settlement_kind: "simulated"` and are never displayed as chain transactions.

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
