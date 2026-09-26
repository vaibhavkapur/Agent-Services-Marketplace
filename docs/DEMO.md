# Demo scenarios

All supplier, document, and price data are fixtures dated 25 September 2026.

## A — Paid research

Create a $2 USDC service-charge task for suppliers `s1`–`s5`. The agent buys five lookups and extracts a couple of documents. The report lists purchased sources and actual service spend.

## B — Budget refusal

Enable `supplier_diligence` ($1.95). After cheaper lookups, remaining allowance cannot cover the premium memo. The agent records the refusal and continues with affordable evidence.

## C — Response recovery

The first lookup is injected with `drop-after-payment`. The coordinator keeps the reservation, fetches `/v1/operations/{operationKey}`, and does not sign a second charge.

## D — Metered session

Document extraction opens an MPP session, accepts page vouchers, interrupts close, then reconciles consumed versus unused funds.
