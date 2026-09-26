# Pinned protocol and environment selections

Planning baseline: 25 September 2026.

| Item | Pin |
| --- | --- |
| MCP spec | `2026-07-28` |
| MCP binding | Application tools over HTTP JSON-RPC; paid HTTP stays outside the MCP envelope |
| x402 | V2 headers, scheme `exact`, network `eip155:84532` (Base Sepolia) |
| x402 asset | USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, 6 decimals |
| x402 facilitator | `https://x402.org/facilitator` when `SETTLEMENT_MODE=testnet` |
| x402 extension | `payment-identifier` bound to the application operation key |
| MPP charge | `tempo.charge` |
| MPP session | `tempo.session` |
| MPP test environment | Tempo chain id `4217`, pathUSD `0x20c0000000000000000000000000000000000000` |
| Default settlement | `SETTLEMENT_MODE=simulated` |

Official SDK targets if you enable testnet keys:

- `@x402/core` / `@x402/evm` / `@x402/fetch` 2.x
- `mppx` current `tempo.charge` and `tempo.session` client/server
- `@modelcontextprotocol/server` v2

Local default does not broadcast chain transactions. Simulated receipts are labeled `settlement_kind: "simulated"` and are never shown as settled network transactions.
