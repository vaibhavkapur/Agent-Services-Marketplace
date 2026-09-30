# Architecture

[Documentation home](index.md)

## Overview

The research loop requests fixture services. An invocation coordinator validates advertised payment terms, reserves service-charge budget, signs through a constrained signer, and records payment and delivery independently.

```text
Next.js UI / research loop → Task API → Invocation coordinator
MCP catalog tools ────────────────────→        │
                                         Budget policy
                                              ↓
                                         Local signer
                                              ↓
                           Lookup service (x402 / MPP charge)
                           Extraction service (MPP session)
                                              ↓
                            Receipts + results + spend journal
```

## Components and technology

- `apps/api`: Fastify API, deterministic research loop, invocation coordinator, sessions, and report assembly.
- `apps/catalog-mcp`: project HTTP JSON-RPC tool binding; paid HTTP stays outside tool result envelopes.
- `apps/lookup-service` and `apps/extraction-service`: owned synthetic suppliers and metered document fixtures.
- `apps/web`: Next.js UI; `apps/research-agent`: separate agent entry point.
- `packages/budget-policy`: term validation, reservations, and spend accounting.
- `packages/signer-interface`: HMAC-based fixture signer with allowed hosts and payment constraints.
- `packages/x402-adapter` and `packages/mpp-adapter`: local challenge/credential/receipt exchanges.
- `packages/reconciliation`, `packages/result-store`, and `packages/db`: recovery helpers, purchased results, and data structures.

## Invocation lifecycle

1. Discover a service and inspect advertised price and supported profiles.
2. Create an application operation key, probe the service, and validate its challenge.
3. Reserve budget before producing a credential.
4. Retry paid HTTP with that credential; record the receipt and delivered result separately.
5. If the response is lost, use the operation-status endpoint to recover the existing result. Keep uncertain reservations rather than authorizing another rail.

Sessions reserve a deposit, account for signed page vouchers, and reconcile consumed versus unused funds at close. Duplicate event IDs must not increase charged usage.

## Implementation boundaries

Runtime stores are in memory. PostgreSQL migrations and Redis services exist in the repository but are not the API's active persistence or queue backend. The signer and settlement adapters are local fixtures, including when the `testnet` setting changes receipt labels. No real chain submission is implemented by those adapters.

The catalog is a project-specific MCP-style binding; the default research loop calls the coordinator directly. See [Protocol Bindings](PROTOCOL_BINDINGS.md), [Protocol Selections](PINS.md), and [Database](database.md) for the exact scope.
