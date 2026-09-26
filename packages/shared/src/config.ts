import type { SettlementMode } from "./types.js";

export type Pins = {
  settlementMode: SettlementMode;
  demoUserId: string;
  signerSecret: string;
  payerAddress: string;
  payeeAddress: string;
  x402: {
    version: 2;
    scheme: "exact";
    network: string;
    asset: string;
    assetSymbol: string;
    decimals: number;
    facilitatorUrl: string;
    maxTimeoutSeconds: number;
  };
  mpp: {
    chargeMethod: string;
    sessionMethod: string;
    chainId: number;
    currency: string;
    currencySymbol: string;
    decimals: number;
  };
};

function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export function loadPins(): Pins {
  const settlementMode = env("SETTLEMENT_MODE", "simulated");
  if (settlementMode !== "simulated" && settlementMode !== "testnet") {
    throw new Error("SETTLEMENT_MODE must be simulated or testnet");
  }
  return {
    settlementMode,
    demoUserId: env("DEMO_USER_ID", "demo-user"),
    signerSecret: env("SIGNER_SECRET", "dev-signer-secret-change-me"),
    payerAddress: env(
      "PAYER_ADDRESS",
      "0x1111111111111111111111111111111111111111",
    ),
    payeeAddress: env(
      "PAYEE_ADDRESS",
      "0x2222222222222222222222222222222222222222",
    ),
    x402: {
      version: 2,
      scheme: "exact",
      network: env("X402_NETWORK", "eip155:84532"),
      asset: env(
        "X402_ASSET",
        "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      ),
      assetSymbol: env("X402_ASSET_SYMBOL", "USDC"),
      decimals: Number(env("X402_DECIMALS", "6")),
      facilitatorUrl: env("X402_FACILITATOR_URL", "https://x402.org/facilitator"),
      maxTimeoutSeconds: Number(env("X402_MAX_TIMEOUT_SECONDS", "60")),
    },
    mpp: {
      chargeMethod: env("MPP_CHARGE_METHOD", "tempo.charge"),
      sessionMethod: env("MPP_SESSION_METHOD", "tempo.session"),
      chainId: Number(env("MPP_CHAIN_ID", "4217")),
      currency: env(
        "MPP_CURRENCY",
        "0x20c0000000000000000000000000000000000000",
      ),
      currencySymbol: env("MPP_CURRENCY_SYMBOL", "pathUSD"),
      decimals: Number(env("MPP_CURRENCY_DECIMALS", "6")),
    },
  };
}
