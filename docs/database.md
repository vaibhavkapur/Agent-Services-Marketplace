# Database and Accounting

[Documentation home](index.md)

## Current runtime storage

`apps/api/src/coordinator.ts` creates `MemoryStore`. Tasks, invocations, payment attempts, budget journal entries, sessions, results, and reports therefore live for the API process lifetime. Supplier result/receipt maps also live in their service processes. Restarting those services can lose state needed for recovery.

The PostgreSQL schema under `migrations/` and `packages/db/src/postgres.ts` is scaffolding. To inspect that schema locally:

```bash
docker compose up -d postgres
export DATABASE_URL=postgres://asm:asm@localhost:5432/asm
pnpm migrate
```

This does not wire PostgreSQL into the running API. The `seed` package script is not a working database seed operation: the CLI only handles `migrate`. Fixture services and in-memory catalog initialization supply demo data.

## Budget and evidence

An invocation separates requested work, authorized payment, settlement outcome, and delivered result. Budget is reserved before signing. Unknown outcomes keep the reservation; successful consumption and unused session-deposit release are separate journal events.

The spending endpoint presents the task's journal. This is service-charge accounting within a fixture, not the custodial double-entry treasury ledger implemented by some related payment repositories.

## Recovery limits

Lost-response demos recover against existing in-memory service operation records. They demonstrate duplicate handling while those records survive, not durable recovery after a full stack restart. Export the report and spending response before stopping a demonstration if they need to be retained.
