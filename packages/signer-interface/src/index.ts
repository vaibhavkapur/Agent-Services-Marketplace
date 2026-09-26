import { hmacHex, type Pins } from "@asm/shared";
import { validateTerms, type PaymentTerms } from "@asm/budget-policy";

export type SignedCredential = {
  protocol: "x402" | "mpp";
  signedAt: number;
  from: string;
  payload: Record<string, unknown>;
};

export class IsolatedSigner {
  constructor(
    private readonly pins: Pins,
    private readonly allowedHosts: string[],
  ) {}

  sign(input: {
    protocol: "x402" | "mpp";
    terms: PaymentTerms;
    resourceHost: string;
    operationKey: string;
    advertisedAtomic?: string;
  }): SignedCredential {
    const decision = validateTerms({
      pins: this.pins,
      terms: input.terms,
      advertisedAtomic: input.advertisedAtomic,
      allowedHosts: this.allowedHosts,
      resourceHost: input.resourceHost,
    });
    if (!decision.ok) {
      throw Object.assign(new Error(decision.reason), { code: decision.code });
    }
    const signedAt = Math.floor(Date.now() / 1000);
    const material = [
      input.protocol,
      input.operationKey,
      input.terms.amountAtomic,
      input.terms.asset,
      input.terms.network,
      input.terms.payTo,
      input.terms.resource,
      String(signedAt),
    ].join("|");
    const signature = hmacHex(this.pins.signerSecret, material);
    return {
      protocol: input.protocol,
      signedAt,
      from: this.pins.payerAddress,
      payload: {
        signature,
        authorization: {
          from: this.pins.payerAddress,
          to: input.terms.payTo,
          value: input.terms.amountAtomic,
          validAfter: String(signedAt - 1),
          validBefore: String(input.terms.expiresAt),
          nonce: hmacHex(this.pins.signerSecret, input.operationKey).slice(0, 32),
          operationKey: input.operationKey,
        },
      },
    };
  }
}
