import { parseAtomic, type Pins, type PolicyDecision } from "@asm/shared";

export type PaymentTerms = {
  asset: string;
  network: string;
  amountAtomic: string;
  payTo: string;
  expiresAt: number;
  resource: string;
  scheme?: string;
  method?: string;
};

export function validateTerms(input: {
  pins: Pins;
  terms: PaymentTerms;
  advertisedAtomic?: string;
  now?: number;
  allowedHosts: string[];
  resourceHost: string;
}): PolicyDecision {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (input.terms.expiresAt <= now) {
    return { ok: false, code: "expired_terms", reason: "Payment terms have expired." };
  }
  if (
    input.terms.asset !== input.pins.x402.asset &&
    input.terms.asset !== input.pins.mpp.currency &&
    input.terms.asset !== "USDC"
  ) {
    return { ok: false, code: "unsupported_asset", reason: "Asset is not authorized for this task." };
  }
  const allowedNetworks = [input.pins.x402.network, `eip155:${input.pins.mpp.chainId}`, "tempo:test"];
  if (!allowedNetworks.includes(input.terms.network)) {
    return { ok: false, code: "unsupported_network", reason: "Network is not authorized for this task." };
  }
  if (input.terms.payTo.toLowerCase() !== input.pins.payeeAddress.toLowerCase()) {
    return { ok: false, code: "unexpected_payee", reason: "Payee is not the registered service operator." };
  }
  if (!input.allowedHosts.includes(input.resourceHost)) {
    return { ok: false, code: "host_not_allowed", reason: "Resource host is outside the allow-list." };
  }
  if (input.advertisedAtomic) {
    const quoted = parseAtomic(input.terms.amountAtomic);
    const advertised = parseAtomic(input.advertisedAtomic);
    if (quoted > advertised) {
      return {
        ok: false,
        code: "price_above_advertised",
        reason: "Runtime price exceeds advertised catalog price. A new budget authorization is required.",
      };
    }
  }
  return { ok: true };
}

export function canReserve(remaining: bigint, quoted: bigint): PolicyDecision {
  if (quoted <= 0n) {
    return { ok: false, code: "invalid_amount", reason: "Quoted amount must be positive." };
  }
  if (quoted > remaining) {
    return {
      ok: false,
      code: "insufficient_budget",
      reason: "Remaining task allowance cannot cover this charge.",
    };
  }
  return { ok: true };
}
