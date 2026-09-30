# API Reference

[Documentation home](index.md)

## Base URL and identity

The API listens at `http://localhost:3001`. Routes are implemented in `apps/api/src/index.ts`. `X-User-Id` chooses the task owner, defaulting to `demo-user`. This is a development identity selector, not authenticated user identity. There is no generated OpenAPI route in this API.

## Tasks and spending

- `GET /health`: health and selected settlement mode.
- `GET /v1/services`: fixture service catalog.
- `POST /v1/tasks`: create a task. Required input includes `goal`, `supplier_ids`, and `budget` (`asset`, `amount_atomic`, `decimals`, `scope`). Optional `allowed_services` defaults to lookup and extraction; `preferred_lookup_protocol` defaults to `x402`.
- `GET /v1/tasks`: list the selected user's tasks.
- `GET /v1/tasks/{id}`: task, budget, invocations, sessions, and report.
- `POST /v1/tasks/{id}/run`: run research; send `{}` or a supported demo `fault`.
- `GET /v1/tasks/{id}/budget`, `/spending`, and `/report`: allowance, journal, and purchased evidence.

Amounts are integer atomic-unit strings. With six decimals, `2000000` means 2 units. The demo's budget scope is `service_charges`; it does not represent a complete wallet balance or gas budget. The fixture accounting is not live foreign-exchange conversion between USDC and pathUSD.

## Individual invocations

```bash
curl -X POST http://localhost:3001/v1/tasks/TASK_ID/invocations \
  -H "Content-Type: application/json" \
  -d '{"service_id":"supplier_lookup","supplier_id":"s1","protocol":"x402"}'
```

`service_id` also supports `supplier_diligence` if the task allows it. `protocol` selects `x402` or `mpp`. Fetch `/v1/invocations/{id}` for payment/events/recovery guidance or `/v1/invocations/{id}/result` for a purchased result. A missing result returns 404; retrieving an existing result does not initiate another charge.

## Metered extraction

- `POST /v1/tasks/{id}/sessions`: optional `deposit_atomic`.
- `POST /v1/sessions/{id}/extract`: `document_id`, `page_indexes`, optional `event_id` for duplicate-event handling.
- `POST /v1/sessions/{id}/close`: `{}` or a demo fault such as `interrupt-session`.
- `POST /v1/sessions/{id}/recover`: reconcile an interrupted session.
- `POST /v1/policy/fallback`: checks a requested `protocol` and `payment_state`; returns 409 when fallback is blocked.

## Catalog tools

At `http://localhost:3004`, `GET /mcp/tools` lists tools and `POST /mcp` handles `initialize`, `tools/list`, and `tools/call`. Tools are `search_services`, `inspect_service`, `get_task_budget`, `lookup_supplier`, `extract_document`, and `get_paid_result`. The catalog forwards requests as the fixed demo user.

## Recovery and errors

Task ownership mismatch returns 403; a missing task returns 404. Payment refusal and unresolved outcomes can be represented inside invocation state, so inspect the body as well as HTTP status. There is no blanket `Idempotency-Key` contract on all public task mutations; operation keys and session event IDs provide the narrower duplicate handling described in [Protocol Bindings](PROTOCOL_BINDINGS.md).
