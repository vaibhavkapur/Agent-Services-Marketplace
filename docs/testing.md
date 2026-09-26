# Testing

[Documentation home](index.md)

## Automated checks

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

Vitest covers term authorization (`tests/authz.test.ts`), budget accounting (`budget.test.ts`), local protocol structures (`protocol.test.ts`), and recovery rules (`recovery.test.ts`). These are fixture tests; they do not validate external facilitator settlement or database-backed restart recovery.

## Demo checks

Run [Demos A–D](DEMO.md): paid research, budget refusal, lost payment response, and interrupted session close. Inspect both task report and spending journal. Confirm simulated receipts remain labelled as such and that unresolved reservations are visible even if the research loop finishes.

The CLI's current result is the source of truth for test totals. No network conformance or throughput claim is implied by the local suite.
