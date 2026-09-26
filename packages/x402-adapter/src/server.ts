import { hmacHex, paymentId, type Pins, type SettlementKind } from "@asm/shared";
import {
  decodeHeader,
  encodeHeader,
  X402_HEADERS,
} from "./headers.js";
import type {
  X402Accept,
  X402PaymentPayload,
  X402PaymentRequired,
  X402SettlementResponse,
} from "./types.js";

export type StoredPaidResult<T> = {
  paymentId: string;
  operationKey: string;
  result: T;
  settlement: X402SettlementResponse;
};

export class X402ResourceServer {
  private readonly store = new Map<string, StoredPaidResult<unknown>>();

  constructor(private readonly pins: Pins) {}

  accept(input: {
    amountAtomic: string;
    resourceUrl: string;
    description: string;
  }): X402PaymentRequired {
    const accept: X402Accept = {
      scheme: this.pins.x402.scheme,
      network: this.pins.x402.network,
      amount: input.amountAtomic,
      asset: this.pins.x402.asset,
      payTo: this.pins.payeeAddress,
      maxTimeoutSeconds: this.pins.x402.maxTimeoutSeconds,
      extra: { name: this.pins.x402.assetSymbol, version: "2" },
    };
    return {
      x402Version: 2,
      error: "PAYMENT-SIGNATURE header is required",
      resource: {
        url: input.resourceUrl,
        description: input.description,
        mimeType: "application/json",
      },
      accepts: [accept],
      extensions: { "payment-identifier": { supported: true } },
    };
  }

  requiredHeaders(required: X402PaymentRequired): Record<string, string> {
    return { [X402_HEADERS.required]: encodeHeader(required) };
  }

  parsePayload(header: string | undefined): X402PaymentPayload | null {
    return decodeHeader<X402PaymentPayload>(header);
  }

  verify(input: {
    payload: X402PaymentPayload;
    expectedAmount: string;
    expectedResource: string;
    operationKey?: string;
  }): { ok: true; paymentId: string; operationKey: string } | { ok: false; reason: string } {
    const accepted = input.payload.accepted;
    if (accepted.scheme !== this.pins.x402.scheme) {
      return { ok: false, reason: "Unsupported x402 scheme." };
    }
    if (accepted.network !== this.pins.x402.network) {
      return { ok: false, reason: "Unsupported x402 network." };
    }
    if (accepted.asset !== this.pins.x402.asset) {
      return { ok: false, reason: "Unsupported x402 asset." };
    }
    if (accepted.amount !== input.expectedAmount) {
      return { ok: false, reason: "Payment amount does not match the offer." };
    }
    if (accepted.payTo.toLowerCase() !== this.pins.payeeAddress.toLowerCase()) {
      return { ok: false, reason: "Unexpected payee." };
    }
    if (input.payload.resource.url !== input.expectedResource) {
      return { ok: false, reason: "Resource mismatch." };
    }
    const auth = input.payload.payload.authorization;
    const material = [
      "x402",
      auth.operationKey,
      accepted.amount,
      accepted.asset,
      accepted.network,
      accepted.payTo,
      input.payload.resource.url,
      String(Number(auth.validAfter) + 1),
    ].join("|");
    const expected = hmacHex(this.pins.signerSecret, material);
    if (expected !== input.payload.payload.signature) {
      return { ok: false, reason: "Invalid payment signature." };
    }
    if (Number(auth.validBefore) <= Math.floor(Date.now() / 1000)) {
      return { ok: false, reason: "Authorization expired." };
    }
    const op = input.operationKey ?? auth.operationKey;
    return {
      ok: true,
      paymentId: input.payload.extensions["payment-identifier"]?.paymentId ?? paymentId(op),
      operationKey: op,
    };
  }

  recall<T>(paymentIdValue: string): StoredPaidResult<T> | undefined {
    return this.store.get(paymentIdValue) as StoredPaidResult<T> | undefined;
  }

  settle<T>(input: {
    paymentId: string;
    operationKey: string;
    result: T;
  }): { settlement: X402SettlementResponse; replay: boolean } {
    const existing = this.store.get(input.paymentId);
    if (existing) {
      return { settlement: existing.settlement, replay: true };
    }
    const kind: SettlementKind = this.pins.settlementMode === "testnet" ? "network" : "simulated";
    if (kind === "network" && !process.env.EVM_PRIVATE_KEY) {
      throw Object.assign(new Error("Testnet settlement requested without EVM_PRIVATE_KEY."), {
        code: "testnet_unconfigured",
      });
    }
    const settlement: X402SettlementResponse = {
      success: true,
      network: this.pins.x402.network,
      payer: this.pins.payerAddress,
      settlementKind: kind,
      transaction: kind === "network" ? `0x${hmacHex(this.pins.signerSecret, input.paymentId)}` : undefined,
    };
    this.store.set(input.paymentId, {
      paymentId: input.paymentId,
      operationKey: input.operationKey,
      result: input.result,
      settlement,
    });
    return { settlement, replay: false };
  }

  responseHeaders(settlement: X402SettlementResponse): Record<string, string> {
    return { [X402_HEADERS.response]: encodeHeader(settlement) };
  }
}
