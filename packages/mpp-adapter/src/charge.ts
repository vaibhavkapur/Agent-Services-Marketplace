import { hmacHex, id, type Pins } from "@asm/shared";
import type { IsolatedSigner } from "@asm/signer-interface";
import type { MppChallenge, MppCredential, MppReceipt } from "./types.js";
import { MPP_HEADERS } from "./types.js";

export function encodeMpp(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

export function decodeMpp<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export class MppChargeServer {
  private readonly results = new Map<string, { receipt: MppReceipt; result: unknown }>();

  constructor(private readonly pins: Pins) {}

  challenge(input: { amountAtomic: string; resource: string }): MppChallenge {
    return {
      method: this.pins.mpp.chargeMethod,
      challengeId: id("mppch"),
      amount: input.amountAtomic,
      currency: this.pins.mpp.currency,
      recipient: this.pins.payeeAddress,
      chainId: this.pins.mpp.chainId,
      resource: input.resource,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
      mode: this.pins.settlementMode === "simulated" ? "proof" : "pull",
    };
  }

  challengeHeaders(challenge: MppChallenge): Record<string, string> {
    return { [MPP_HEADERS.challenge]: encodeMpp(challenge) };
  }

  parseCredential(header: string | undefined): MppCredential | null {
    return decodeMpp<MppCredential>(header);
  }

  verify(input: {
    challenge: MppChallenge;
    credential: MppCredential;
    expectedAmount: string;
  }): { ok: true } | { ok: false; reason: string } {
    if (input.credential.challengeId !== input.challenge.challengeId) {
      return { ok: false, reason: "Credential does not match the challenge." };
    }
    if (input.challenge.amount !== input.expectedAmount) {
      return { ok: false, reason: "Challenge amount changed." };
    }
    const auth = input.credential.payload.authorization;
    const material = [
      "mpp",
      auth.operationKey,
      input.challenge.amount,
      input.challenge.currency,
      `eip155:${input.challenge.chainId}`,
      input.challenge.recipient,
      input.challenge.resource,
      String(Number(auth.validAfter) + 1),
    ].join("|");
    if (hmacHex(this.pins.signerSecret, material) !== input.credential.payload.signature) {
      return { ok: false, reason: "Invalid MPP credential." };
    }
    return { ok: true };
  }

  settle<T>(input: { challenge: MppChallenge; result: T }): { receipt: MppReceipt; replay: boolean } {
    const existing = this.results.get(input.challenge.challengeId);
    if (existing) return { receipt: existing.receipt, replay: true };
    const kind = this.pins.settlementMode === "testnet" ? "network" : "simulated";
    if (kind === "network" && !process.env.MPP_SECRET_KEY) {
      throw Object.assign(new Error("Testnet MPP settlement requested without MPP_SECRET_KEY."), {
        code: "testnet_unconfigured",
      });
    }
    const receipt: MppReceipt = {
      challengeId: input.challenge.challengeId,
      success: true,
      method: input.challenge.method,
      amount: input.challenge.amount,
      currency: input.challenge.currency,
      settlementKind: kind,
      transaction: kind === "network" ? `0x${hmacHex(this.pins.signerSecret, input.challenge.challengeId)}` : undefined,
    };
    this.results.set(input.challenge.challengeId, { receipt, result: input.result });
    return { receipt, replay: false };
  }

  recall<T>(challengeId: string): { receipt: MppReceipt; result: T } | undefined {
    return this.results.get(challengeId) as { receipt: MppReceipt; result: T } | undefined;
  }

  receiptHeaders(receipt: MppReceipt): Record<string, string> {
    return { [MPP_HEADERS.receipt]: encodeMpp(receipt) };
  }
}

export class MppChargeClient {
  constructor(
    private readonly pins: Pins,
    private readonly signer: IsolatedSigner,
  ) {}

  readChallenge(headers: Headers | Record<string, string | undefined>): MppChallenge | null {
    return decodeMpp<MppChallenge>(header(headers, MPP_HEADERS.challenge));
  }

  readReceipt(headers: Headers | Record<string, string | undefined>): MppReceipt | null {
    return decodeMpp<MppReceipt>(header(headers, MPP_HEADERS.receipt));
  }

  authorize(input: {
    challenge: MppChallenge;
    operationKey: string;
    resourceHost: string;
    advertisedAtomic?: string;
  }): { credential: MppCredential; header: Record<string, string> } {
    const signed = this.signer.sign({
      protocol: "mpp",
      resourceHost: input.resourceHost,
      operationKey: input.operationKey,
      advertisedAtomic: input.advertisedAtomic,
      terms: {
        asset: input.challenge.currency,
        network: `eip155:${input.challenge.chainId}`,
        amountAtomic: input.challenge.amount,
        payTo: input.challenge.recipient,
        expiresAt: input.challenge.expiresAt,
        resource: input.challenge.resource,
        method: input.challenge.method,
      },
    });
    const credential: MppCredential = {
      challengeId: input.challenge.challengeId,
      type: input.challenge.mode === "proof" ? "proof" : "transaction",
      payload: signed.payload as MppCredential["payload"],
    };
    return {
      credential,
      header: { [MPP_HEADERS.credential]: encodeMpp(credential) },
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
