# MCP / payment binding

[Documentation home](index.md)

Paid MCP transport is deferred. This project uses:

1. MCP tools for discovery and task-safe operations.
2. An invocation coordinator that owns budget, signing, and paid HTTP.
3. Local x402 V2 and MPP-shaped fixture exchanges only between the coordinator and owned services; see [implementation status](PINS.md#implementation-status).

A 402 HTTP response is never forwarded as an MCP tool result. Tools return application JSON after the coordinator has reserved budget, signed an approved challenge, and recorded receipt plus delivery state.

The model cannot supply recipient addresses, private keys, or a new budget. Automatic protocol fallback is blocked while a payment is authorized, pending, settled, or unknown.

## x402 V2 exact

Probe → `PAYMENT-REQUIRED` → isolated signer → retry with `PAYMENT-SIGNATURE` → `PAYMENT-RESPONSE`.

The application operation key is also the payment-identifier. A lost 200 still recovers from `/v1/operations/{operationKey}` without a new charge.

## MPP charge

Probe → `MPP-Challenge` → isolated signer → retry with `MPP-Credential` → `MPP-Receipt`.

The same supplier fixture is offered through both rails so protocol evidence can be compared.

## MPP session

Open a bounded session, fund a deposit from the task budget, meter pages with signed vouchers, then close. Duplicate event IDs do not increase authorized usage. An interrupted close stays unresolved until the session is queried and closed again. Unused deposit is released, not booked as a second expense.

## Recovery boundary

Operation and receipt lookup depends on in-memory records in the API and services. The response-loss demonstrations assume those processes retain state; they do not establish full-stack restart recovery. See [Database](database.md).
