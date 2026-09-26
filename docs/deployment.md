# Deployment

[Documentation home](index.md)

## Local development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Alternatively run `docker compose up --build`. Compose starts PostgreSQL, Redis, lookup, extraction, API, catalog, and web. The web URL is `http://localhost:3000`; API health is `http://localhost:3001/health`.

PostgreSQL has the `asm_pg` volume, but application tasks and payment records remain in memory. Starting the database and cache is not a persistence migration. See [Database](database.md).

## Operations

Use `docker compose ps` and `docker compose logs api lookup-service extraction-service` to inspect the stack. On an interrupted session, retain the services and call its recover endpoint; inspect outstanding budget reservations and purchased results. Stopping and restarting the process is not a substitute for reconciliation.

## Deployment scope

The current system is an owned-service fixture with permissive CORS, caller-selected `X-User-Id`, synthetic credentials, and simulated settlement. `SETTLEMENT_MODE=testnet` changes labels and requires configured key fields in some paths, but the adapters still construct local transaction references. It is not a supported real-money or independently verified testnet deployment.

Production persistence, authenticated identity, independent signing custody, and actual payment-provider adapters are future integration work. Existing local wire exchanges and their limitations are documented in [Protocol Bindings](PROTOCOL_BINDINGS.md).
