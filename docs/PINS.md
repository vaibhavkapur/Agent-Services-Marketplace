# Pinned protocol and environment selections

[Documentation home](index.md)

Planning baseline: 25 September 2026.

| Item | Pin |
| --- | --- |
| MCP spec | `2026-07-28` |
| MCP binding | Application tools over HTTP JSON-RPC; paid HTTP stays outside the MCP envelope |
| x402 | V2 headers, scheme `exact`, network `eip155:84532` (Base Sepolia) |
| x402 asset | USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, 6 decimals |
| x402 facilitator | `https://x402.org/facilitator` configured; no facilitator request in current adapters |
| x402 extension | `payment-identifier` bound to the application operation key |
| MPP charge | `tempo.charge` |
| MPP session | `tempo.session` |
| MPP test environment | Tempo chain id `4217`, pathUSD `0x20c0000000000000000000000000000000000000` |
| Default settlement | `SETTLEMENT_MODE=simulated` |

Future SDK integration targets (not installed or activated by supplying testnet keys):

- `@x402/core` / `@x402/evm` / `@x402/fetch` 2.x
- `mppx` current `tempo.charge` and `tempo.session` client/server
- `@modelcontextprotocol/server` v2

Local default does not broadcast chain transactions. Simulated receipts are labeled `settlement_kind: "simulated"` and are never shown as settled network transactions.

## Implementation status

These values describe the project's selected fixture profiles and future integration targets. They are not evidence of full upstream conformance. The catalog implements a project HTTP JSON-RPC binding directly; the default research loop calls the coordinator rather than discovering services through the catalog.

The signer uses a shared HMAC fixture secret. x402 and MPP settlement adapters store local receipts; `SETTLEMENT_MODE=testnet` can label a receipt as `network` and generate an HMAC-derived transaction reference, but it does not submit a chain transaction. Supplying `EVM_PRIVATE_KEY` or `MPP_SECRET_KEY` does not change that implementation. Use `simulated` for the documented demos.

The API constructs `MemoryStore`; PostgreSQL migrations and Redis configuration do not enable durable runtime storage. See [Database](database.md) and [Configuration](configuration.md).
