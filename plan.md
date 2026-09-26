# Agent Services Marketplace — Development Plan

## 1. Project summary

Build a **marketplace where an agent discovers useful services, pays for access, and tracks its spending while completing a task**.

Example request:

> “Research these five suppliers and prepare a comparison. You may spend up to $2 on external data.”

The agent should:

- discover available services through MCP
- inspect capabilities and quoted prices
- choose services that fit the task and remaining budget
- purchase API access through x402 or MPP
- collect results and payment evidence
- handle retries without purchasing the same result again
- produce a report with an itemized cost breakdown

The core product is **an agent tool marketplace with payment-aware execution, budget reservations, and reconciliation**.

Planning baseline: **25 September 2026**. Prices, suppliers, and reports in this plan are demo fixtures.

---

## 2. Why this project is compelling

An agent often needs a paid capability while working: a database lookup, document extraction, compute job, or premium data feed.

This project demonstrates the complete economic decision:

1. Is this service useful?
2. What will it cost?
3. Is spending authorized?
4. Did payment occur?
5. Was the promised result delivered?

It extends your stablecoin checkout work into machine-to-machine commerce. The emphasis is service consumption, metering, and reliable paid requests rather than shopping for physical goods.

---

## 3. Protocol responsibilities

### MCP — tool and service discovery

Expose service search, capability descriptions, and task-safe tool calls through MCP. Use typed inputs and outputs. A payment policy service decides whether a discovered tool can spend money; discovery itself grants no spending authority. [MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture)

### x402 — paid HTTP requests

Implement a fixed-price paid endpoint using a pinned x402 V2 scheme. Show payment requirements, the authorized retry, and settlement evidence. Distinguish verification from settlement and service delivery. [x402 HTTP flow](https://docs.x402.org/core-concepts/http-402)

### MPP — paid requests and metered sessions

Implement a separate MPP charge path, then a session that meters repeated usage. Use the selected method's challenge, credential, receipt, and settlement semantics. [MPP sessions](https://mpp.dev/blog/sessions-improved)

These protocols have overlapping capabilities. Compare implemented profiles rather than claiming x402 always means per-call payments or MPP always means streaming. MPP's SDK also documents support for x402 exact flows. [MPP interoperability](https://mpp.dev/blog/evm-x402-support)

---

## 4. MVP scope

### First working slice

- one authenticated user and one research agent
- two services owned by the project
- one fixed-price supplier lookup endpoint
- one fixed-price document extraction endpoint
- an MCP catalog and tool interface
- one x402 route and one MPP charge route
- a task-level spending budget
- durable invocation records and cached paid results

### Complete portfolio release

- equivalent lookup workload offered through both payment paths
- one MPP metered-session demonstration
- real testnet settlement for supported selected methods
- spend reconciliation and failure injection

### Defer

- open seller registration
- real supplier personal data
- platform commissions and seller payouts
- subscriptions and recurring charges
- automatic foreign-exchange conversion
- a large public service directory

Running your own services makes replay, delivery, and payment failures reproducible.

---

## 5. Recommended technology stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS
- **Services and worker:** TypeScript with Fastify
- **Persistence:** PostgreSQL
- **Jobs/cache:** Redis and a durable worker where useful
- **MCP:** a maintained SDK compatible with the selected protocol version
- **Payments:** pinned x402 SDK and MPP `mppx` SDK
- **Blockchain:** a supported EVM test network for charge flows; a supported session-method test environment for the session milestone
- **Tests:** unit tests, HTTP integration tests, deterministic clock and network fixtures
- **Local development:** Docker Compose

Before choosing a chain, confirm that the SDK, facilitator or relay, token, and payment scheme all support the same test environment. Record those selections in configuration.

---

## 6. High-level architecture

```text
User → Research UI → Agent orchestrator
                         ↓
                    MCP tools
                         ↓
Service catalog → Invocation coordinator → Budget policy
                         ↓                    ↓
                    Payment router ← Isolated signer
                         ├─ x402 client → Paid lookup service
                         └─ MPP client  → Extraction / session service
                         ↓
                Result store + receipt store
                         ↓
                  Report generator

Recovery worker → unresolved charges, missing results, open sessions
```

The model selects useful operations. Deterministic code verifies payment terms, reserves budget, and signs only approved payment requests.

---

## 7. Service catalog design

Each catalog entry should include:

- service ID and operator identity
- capability description
- input and output schema
- endpoint and supported payment profiles
- advertised pricing and freshness timestamp
- expected result format
- data provenance and usage restrictions
- locally measured availability, when available

Catalog pricing is advisory. Validate the current payment challenge before spending.

Example application record:

```json
{
  "service_id": "supplier_lookup",
  "description": "Return a structured supplier profile from the demo dataset",
  "capability": "supplier.lookup",
  "payment_profiles": ["x402-exact", "mpp-charge"],
  "advertised_price": {
    "asset": "USDC",
    "amount_atomic": "20000",
    "decimals": 6
  },
  "input_schema_ref": "supplier-lookup-v1",
  "output_schema_ref": "supplier-profile-v1"
}
```

This is not an official x402, MPP, or MCP catalog schema.

---

## 8. MCP interface

Suggested application tools:

- `search_services(capability)`
- `inspect_service(service_id)`
- `get_task_budget(task_id)`
- `lookup_supplier(task_id, supplier_id)`
- `extract_document(task_id, document_id)`
- `get_paid_result(invocation_id)`

The paid tools delegate to the invocation coordinator. They never accept arbitrary recipient addresses or private keys from the model.

Start with MCP tools that call the project's paid HTTP services internally. Do not assume an HTTP 402 response automatically becomes a valid MCP tool response. Document the chosen MCP/payment binding before implementing native paid MCP transport as an extension.

---

## 9. End-to-end fixed-price flow

1. User creates a research task and spending cap.
2. Agent discovers an appropriate service.
3. Coordinator creates a durable invocation with a stable operation ID.
4. Client requests the resource and receives payment terms.
5. Coordinator validates service identity, resource, amount, asset, network, and expiry.
6. Budget service reserves the maximum allowed cost atomically.
7. Isolated signer creates the selected protocol credential.
8. Client retries the same operation with payment authorization.
9. Service verifies and settles under its configured payment profile.
10. Service durably associates the charge and result with the operation.
11. Client records receipt, result, and actual spending.
12. Report generator uses the verified result with source attribution.

If any stage is uncertain, preserve the attempt and reservation for recovery.

---

## 10. x402 implementation details

Use official V2 serialization and headers from the selected SDK. In the trace inspector, show payment requirements, the payment payload, verification outcome, and settlement response with sensitive data redacted. [x402 V2 headers](https://docs.x402.org/core-concepts/http-402)

Choose one explicit scheme and network binding for V1. If a facilitator is used, confirm its supported schemes before issuing a payable offer.

For the owned service, add a durable application operation ID and request-body digest. Where supported, use the protocol's payment-identifier extension consistently with that application record.

A second HTTP request with the same business identity must either return the stored result or recover the pending invocation. It must not issue an unrelated new charge simply because the first response was lost.

---

## 11. MPP charge and session design

### Charge flow

Use a fixed-price MPP charge path for the same lookup fixture offered through x402. Persist challenge identity, selected payment method, credential reference, and receipt outcome.

### Session flow

Demonstrate document extraction billed per page:

- authorize a bounded session
- meter accepted pages
- persist cumulative authorized usage
- settle under the selected method's rules
- close and reconcile the session
- verify disposition of unused funds according to that method

MPP sessions support incremental usage authorization, with method-specific mechanics. Use the current SDK and method specification rather than assuming every rail implements identical channels or refund behavior. [MPP session model](https://mpp.dev/blog/sessions-improved)

Session closure is a durable workflow. A lost close response leaves the session unresolved until queried or otherwise reconciled.

---

## 12. Budget model

Use an explicit asset and integer atomic units. For a six-decimal test token, two units equals `2000000` atomic units.

Separate:

- task budget
- reserved spending
- completed spending
- session funds locked but not yet consumed
- network fees in their native asset

For the demo, define the user's $2 cap as **service charges only**, with a separately displayed network-fee allowance. If USDC is presented in dollar terms, label the 1:1 valuation as a demo assumption. An all-in dollar cap requires a separate conversion and fee policy.

```text
available = budget - completed_spend - active_reservations
```

Never subtract both a session deposit and the usage funded by that same deposit as independent expenses. Represent committed funds and consumed value separately.

---

## 13. Reservation and accounting rules

Inside one database transaction:

1. lock the task budget
2. check whether the invocation already exists
3. verify remaining allowance
4. create the spending reservation
5. create the payment attempt and outbox event

Persist authorization state before sending credentials externally.

Use an append-only budget journal with entries such as `reserve`, `commit`, `release`, and `adjust`. Each entry has an operation reference and unique idempotency identity.

The MVP tracks spending authority; it is not a custodial customer-balance ledger. If seller balances and platform custody are later added, implement a proper double-entry ledger separately, balanced per asset.

Reconcile the budget journal against payment evidence and actual service usage.

---

## 14. Data model

### `research_tasks`

- `id`, `user_id`, `goal`, `status`
- `budget_asset`, `budget_atomic`, `fee_policy_id`
- `created_at`, `completed_at`

### `services`

- `id`, `operator_id`, `endpoint`, `capability`
- `input_schema`, `output_schema`, `payment_profiles`
- `advertised_terms`, `terms_updated_at`

### `invocations`

- `id`, `task_id`, `service_id`, `operation_key`
- `request_digest`, `delivery_state`, `result_reference`
- `created_at`, `last_reconciled_at`

### `payment_attempts`

- `id`, `invocation_id`, `protocol`, `profile_version`
- `challenge_reference`, `asset`, `network`, `amount_atomic`
- `authorization_state`, `settlement_state`, `receipt_reference`
- `transaction_reference`, `failure_reason`

### `metered_sessions`

- `id`, `task_id`, `service_id`, `native_session_id`
- `funded_atomic`, `authorized_usage_atomic`, `settled_atomic`
- `usage_sequence`, `close_state`, `unused_funds_state`

### Supporting records

- `budget_journal`: reservations, consumption, releases
- `usage_events`: immutable unit counts with unique event IDs
- `results`: payload, schema version, checksum, provenance
- `protocol_events`: redacted exchange records

Enforce uniqueness on operation keys, usage events, and journal references.

---

## 15. API design

These are proposed application endpoints:

```http
POST /v1/tasks
GET  /v1/tasks/{id}
GET  /v1/tasks/{id}/budget
GET  /v1/services
POST /v1/tasks/{id}/invocations
GET  /v1/invocations/{id}
GET  /v1/invocations/{id}/result
POST /v1/tasks/{id}/sessions
POST /v1/sessions/{id}/close
GET  /v1/tasks/{id}/spending
GET  /v1/tasks/{id}/report
```

Example request:

```json
{
  "goal": "Compare five demo suppliers",
  "supplier_ids": ["s1", "s2", "s3", "s4", "s5"],
  "budget": {
    "asset": "USDC",
    "amount_atomic": "2000000",
    "decimals": 6,
    "scope": "service_charges"
  },
  "allowed_services": ["supplier_lookup", "document_extraction"]
}
```

Paid provider routes expose native protocol behavior independently of these task-management APIs.

---

## 16. State machines

Track three dimensions separately:

```text
Invocation:
created → quoted → budget_reserved → authorizing → requesting
requesting → completed | recovery_required | rejected

Payment:
not_started → authorized → settlement_pending → settled
settlement_pending → failed | outcome_unknown

Delivery:
not_started → processing → available → retrieved
processing → failed | outcome_unknown
```

Payment success with missing data is not a successful task. Keep the financial state while recovering delivery or initiating the service's explicit refund policy.

---

## 17. Failure handling

### Higher price than advertised

Use the runtime terms. Reject or obtain a new user budget if they exceed policy. Never sign first and check the budget afterward.

### Lost paid response

Retrieve the stored operation result or query its state. Do not silently create another payment credential for a new operation.

### Two concurrent tools

Serialize reservations against the same task budget. Both cannot spend the same remaining allowance.

### Service failed after payment

Retry result delivery under the existing purchase identity. Track a refund request separately if the service's terms support one.

### Unknown settlement

Keep funds reserved. Reconcile with the facilitator, provider, or network before releasing the reservation.

### Interrupted session

Persist usage and session identifiers. Resume or close using the selected method's recovery rules.

---

## 18. Security and authority boundaries

- Keep wallet keys in an isolated signer, outside model context.
- Bind approved payment terms to the requested service operation.
- Restrict allowed hosts and guard redirects and discovery against unintended network access.
- Validate payee, asset, network, amount, and expiry against policy.
- Treat returned documents as untrusted content.
- Prevent service output from raising the task budget or registering new payees.
- Authenticate task ownership on result and receipt endpoints.
- Redact reusable credentials from logs and exports.

Any automatic protocol fallback must preserve the same resource and spending constraints. Do not retry through a different protocol while the first payment may have succeeded.

---

## 19. User interface and metrics

Show:

- task goal and budget
- proposed services and current prices
- available, reserved, and consumed amounts
- each invocation's payment and delivery status
- session usage and closure state
- final report with purchased-source references

An expandable trace inspector should reveal protocol exchanges and verification stages.

For comparisons, run the same fixture, payload size, network configuration, and workload where possible. Report sample count, p50/p95 latency, actual fees, failures, and unresolved outcomes. Separate local simulation measurements from testnet measurements and explain network differences.

---

## 20. Phased delivery plan

### Phase 1 — marketplace and budget core

Build task APIs, service catalog, MCP tools, deterministic providers, and atomic budget reservations.

Success: concurrent tools cannot overspend a task.

### Phase 2 — x402 paid service

Add one fixed-price route, supported testnet settlement, receipts, and durable result lookup.

Success: a paid retry obtains the result and a lost response does not cause another charge.

### Phase 3 — MPP charge and comparison

Expose an equivalent workload through MPP, record protocol-specific evidence, and compare identical tasks.

Success: both routes deliver the same application result with independently verified payment evidence.

### Phase 4 — metered session and reconciliation

Add the session method, durable usage events, closure recovery, and spend reconciliation.

Success: interruption and duplicate usage events do not inflate authorized consumption.

---

## 21. Suggested roadmap and repository

Planning estimate: **four focused weeks** after validating the chosen payment-method support.

- Week 1: catalog, MCP, budget journal, provider fixtures.
- Week 2: x402 client/server, settlement, result recovery.
- Week 3: MPP charge, comparable workload, receipts.
- Week 4: sessions, interruption tests, report UI, documentation.

```text
agent-services-marketplace/
  apps/{web,api,research-agent,catalog-mcp,lookup-service,extraction-service}/
  packages/
    invocation-domain/
    budget-policy/
    x402-adapter/
    mpp-adapter/
    signer-interface/
    result-store/
    reconciliation/
  fixtures/
  tests/{unit,protocol,budget,recovery}/
  migrations/
  docs/
  docker-compose.yml
```

---

## 22. Testing and demo scenarios

### Required tests

- budget arithmetic and concurrent reservations
- unsupported asset/network rejection
- altered or expired payment terms
- settlement succeeds but delivery times out
- replay of the same paid operation
- duplicate and out-of-order usage events
- session close interruption
- result access by another user
- protocol fallback blocked during uncertain payment

### Demo A — paid research

Agent buys five small lookups, produces a report, and displays the actual service spend.

### Demo B — budget refusal

A premium source costs more than the remaining allowance. The agent explains the limitation and continues with affordable evidence.

### Demo C — response recovery

Drop a response after payment. Retrieve the paid result without another charge.

### Demo D — metered session

Extract a few pages, interrupt the client, recover the session, and reconcile consumed versus unused funds.

---

## 23. Definition of done and portfolio framing

The release includes real MCP discovery/tool calls, native x402 and MPP exchanges, testnet evidence for supported profiles, a metered-session demonstration, and reproducible spending/recovery tests.

Document any simulated rail separately. Mock charges must never be displayed as settled network transactions.

Portfolio wording after completion:

> Built an agent services marketplace using MCP, x402, and MPP, with payment-aware tool execution, concurrent budget reservations, metered sessions, receipt reconciliation, and recovery from paid-request failures.

---

## 24. Primary references and immediate next steps

- [MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture)
- [x402 payment flow and V2 headers](https://docs.x402.org/core-concepts/http-402)
- [MPP overview](https://mpp.dev/)
- [MPP sessions](https://mpp.dev/blog/sessions-improved)
- [MPP EVM and x402 integration](https://mpp.dev/blog/evm-x402-support)

Pin exact SDK versions, protocol versions, network/token identifiers, and settlement profiles. Payment methods and SDK entry points evolve; use examples matching those pins.

Begin with one research task, one fixed-price service, a durable operation ID, and a budget reservation. Prove lost-response recovery before adding another service.

**One-sentence summary:** A research agent that buys the services it needs through machine-payment protocols while keeping spending, delivery, and settlement independently accountable.
