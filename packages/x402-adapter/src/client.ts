import { paymentId, type Pins } from "@asm/shared";
import type { IsolatedSigner } from "@asm/signer-interface";
import { decodeHeader, encodeHeader, X402_HEADERS } from "./headers.js";
import type {
  X402PaymentPayload,
  X402PaymentRequired,
  X402SettlementResponse,
} from "./types.js";

export class X402Client {
  constructor(
    private readonly pins: Pins,
    private readonly signer: IsolatedSigner,
  ) {}

  readRequired(headers: Headers | Record<string, string | undefined>): X402PaymentRequired | null {
    return decodeHeader<X402PaymentRequired>(header(headers, X402_HEADERS.required));
  }

  readSettlement(headers: Headers | Record<string, string | undefined>): X402SettlementResponse | null {
    return decodeHeader<X402SettlementResponse>(header(headers, X402_HEADERS.response));
  }

  authorize(input: {
    required: X402PaymentRequired;
    operationKey: string;
    resourceHost: string;
    advertisedAtomic?: string;
  }): { payload: X402PaymentPayload; header: Record<string, string> } {
    const accepted = input.required.accepts[0];
    if (!accepted) throw new Error("x402 offer contained no accepts entries.");
    const signed = this.signer.sign({
      protocol: "x402",
      resourceHost: input.resourceHost,
      operationKey: input.operationKey,
      advertisedAtomic: input.advertisedAtomic,
      terms: {
        asset: accepted.asset,
        network: accepted.network,
        amountAtomic: accepted.amount,
        payTo: accepted.payTo,
        expiresAt: Math.floor(Date.now() / 1000) + accepted.maxTimeoutSeconds,
        resource: input.required.resource.url,
        scheme: accepted.scheme,
      },
    });
    const payload: X402PaymentPayload = {
      x402Version: 2,
      resource: input.required.resource,
      accepted,
      payload: signed.payload as X402PaymentPayload["payload"],
      extensions: {
        "payment-identifier": { paymentId: paymentId(input.operationKey) },
      },
    };
    return {
      payload,
      header: { [X402_HEADERS.signature]: encodeHeader(payload) },
    };
  }
}

function header(
  headers: Headers | Record<string, string | undefined>,
  name: string,
): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  return headers[name] ?? headers[name.toLowerCase()];
}
