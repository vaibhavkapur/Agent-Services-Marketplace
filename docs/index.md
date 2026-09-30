# Agent Services Marketplace

A local research-service marketplace demonstrating discovery, paid HTTP invocations, bounded spending, metered extraction, and separate payment and delivery evidence.

[Get Started](getting-started.md) · [API Reference](api-reference.md) · [Repository README](../README.md)

## Key Features

- Owned lookup services with local x402 V2 and MPP-shaped payment exchanges.
- Budget reservation, constrained signing, and explicit refusal of unsafe protocol fallback.
- Metered sessions, purchased-result retrieval, and lost-response recovery within the running fixture.

## Tech Stack and Scope

TypeScript / pnpm workspaces / Fastify / Next.js / Vitest. API and supplier state are in memory. Settlement uses local HMAC fixtures; live testnet submission is not implemented.

## Documentation

- [Getting Started](getting-started.md)
- [Architecture](architecture.md)
- [API Reference](api-reference.md)
- [Configuration](configuration.md)
- [Database and Accounting](database.md)
- [Testing](testing.md)
- [Deployment](deployment.md)
- [Protocol Bindings](PROTOCOL_BINDINGS.md)
- [Protocol Selections](PINS.md)
- [Demo Scenarios](DEMO.md)

## Project Structure

- `apps/`: API, catalog, lookup, extraction, research agent, and UI.
- `packages/`: policy, accounting, signer, adapters, results, and reconciliation.
- `fixtures/`, `migrations/`, `tests/`: synthetic data, PostgreSQL scaffolding, and tests.

The implementation guides describe the current code. [Development plan](../plan.md) records design intent and future work; planned features are not automatically implemented.

## Related projects

These are independent companion repositories, not runtime dependencies or claims of an implemented integration:

- [Cross-Border Payments Engine](https://github.com/vaibhavkapur/Cross-Border-Payments-Engine): remittance quoting, settlement lifecycle, and ledger demonstration.
- [Stablecoin Payments API](https://github.com/vaibhavkapur/Stablecoin-Payments-API): customer, wallet, deposit, transfer, and checkout API.
- [Agentic Commerce + Stablecoin Checkout](https://github.com/vaibhavkapur/Agentic-Commerce-Stablecoin-Checkout): conversational commerce, policy checks, and payment routing.
- [Smart Wallet Policy Engine](https://github.com/vaibhavkapur/smart-wallet-policy-engine): transaction risk evaluation and wallet authorization.
- [Stablecoin Payment Orchestrator](https://github.com/vaibhavkapur/Stablecoin-Payment-Orchestrator): USDC routing, workers, and treasury accounting.
