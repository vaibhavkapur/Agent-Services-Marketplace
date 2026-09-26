# Configuration

[Documentation home](index.md)

## Loading settings

`packages/shared/src/config.ts` reads process environment variables. `.env.example` is a reference; the application does not automatically import it. Compose interpolates selected variables into service environments. Defaults run the local simulated demo.

## Service addresses

- API `PORT`: `3001`; lookup `PORT`: `3002`; extraction `PORT`: `3003`; catalog `PORT`: `3004`. Set ports per process, not one global value for the whole development stack.
- `LOOKUP_SERVICE_URL`: `http://localhost:3002`.
- `EXTRACTION_SERVICE_URL`: `http://localhost:3003`.
- Catalog `API_URL`: `http://localhost:3001`.
- UI `NEXT_PUBLIC_API_URL`: `http://localhost:3001`.
- `DEMO_USER_ID`: `demo-user` for the API fallback; catalog calls use the literal demo user.

## Payment fixtures

- `SETTLEMENT_MODE`: `simulated` by default. The parser also accepts `testnet`, but current adapters generate local HMAC-derived transaction references instead of broadcasting. Keep examples in simulated mode.
- `SIGNER_SECRET`: `dev-signer-secret-change-me`; shared by the local signer and fixture verifiers.
- `PAYER_ADDRESS` and `PAYEE_ADDRESS`: synthetic `0x111…1111` and `0x222…2222` defaults; not funded accounts.
- `X402_NETWORK`: `eip155:84532`; `X402_ASSET`, `X402_ASSET_SYMBOL`, `X402_DECIMALS`, and `X402_MAX_TIMEOUT_SECONDS` configure fixture terms (USDC, 6 decimals, 60 seconds by default).
- `X402_FACILITATOR_URL`: recorded configuration; the local settlement server does not call a facilitator. x402 version `2` and scheme `exact` are fixed in code, even though `.env.example` lists similarly named variables.
- `MPP_CHARGE_METHOD` / `MPP_SESSION_METHOD`: `tempo.charge` / `tempo.session`; chain/currency settings are listed in [Protocol Selections](PINS.md).
- `LOOKUP_PRICE`: `20000` atomic units; `DILIGENCE_PRICE`: `1950000` atomic units at the lookup service.

## Infrastructure settings

`DATABASE_URL` is consumed by the migration helper (`pnpm migrate`). It does not switch the API away from `MemoryStore`. `REDIS_URL` in Compose does not activate a durable worker queue. Optional private-key fields in `.env.example` do not implement live settlement. See [Database](database.md) and [Deployment](deployment.md).
