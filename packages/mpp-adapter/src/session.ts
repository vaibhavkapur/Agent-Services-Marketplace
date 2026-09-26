import { hmacHex, id, type Pins } from "@asm/shared";
import { decodeMpp, encodeMpp } from "./charge.js";
import {
  MPP_HEADERS,
  type MppSessionChallenge,
  type MppSessionReceipt,
  type MppVoucher,
} from "./types.js";

export type SessionRecord = {
  sessionId: string;
  fundedAtomic: bigint;
  authorizedUsageAtomic: bigint;
  settledAtomic: bigint;
  usageSequence: number;
  seenEvents: Set<string>;
  closeState: "open" | "closing" | "closed" | "close_interrupted" | "reconciled";
  unusedFundsState: "not_applicable" | "held" | "returned" | "unknown";
};

export class MppSessionServer {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(
    private readonly pins: Pins,
    private readonly unitPriceAtomic: bigint,
  ) {}

  open(input: { suggestedDeposit: string; resource: string }): MppSessionChallenge {
    const sessionId = id("mpps");
    this.sessions.set(sessionId, {
      sessionId,
      fundedAtomic: 0n,
      authorizedUsageAtomic: 0n,
      settledAtomic: 0n,
      usageSequence: 0,
      seenEvents: new Set(),
      closeState: "open",
      unusedFundsState: "held",
    });
    return {
      method: this.pins.mpp.sessionMethod,
      sessionId,
      suggestedDeposit: input.suggestedDeposit,
      currency: this.pins.mpp.currency,
      recipient: this.pins.payeeAddress,
      chainId: this.pins.mpp.chainId,
      unitPriceAtomic: this.unitPriceAtomic.toString(),
      resource: input.resource,
    };
  }

  fund(sessionId: string, amountAtomic: bigint): SessionRecord {
    const session = this.require(sessionId);
    session.fundedAtomic += amountAtomic;
    return session;
  }

  acceptVoucher(voucher: MppVoucher): { accepted: boolean; session: SessionRecord; duplicate: boolean } {
    const session = this.require(voucher.sessionId);
    if (session.seenEvents.has(voucher.eventId)) {
      return { accepted: false, session, duplicate: true };
    }
    if (voucher.sequence !== session.usageSequence + 1 && voucher.sequence !== session.usageSequence) {
      throw Object.assign(new Error("Out-of-order usage event."), { code: "out_of_order_usage" });
    }
    if (voucher.sequence === session.usageSequence) {
      return { accepted: false, session, duplicate: true };
    }
    const expected = hmacHex(
      this.pins.signerSecret,
      [voucher.sessionId, voucher.eventId, voucher.cumulativeAtomic, String(voucher.sequence)].join("|"),
    );
    if (expected !== voucher.signature) {
      throw Object.assign(new Error("Invalid session voucher."), { code: "invalid_voucher" });
    }
    const next = BigInt(voucher.cumulativeAtomic);
    if (next < session.authorizedUsageAtomic) {
      return { accepted: false, session, duplicate: true };
    }
    if (next > session.fundedAtomic) {
      throw Object.assign(new Error("Voucher exceeds funded session deposit."), {
        code: "session_overdraw",
      });
    }
    session.seenEvents.add(voucher.eventId);
    session.usageSequence = voucher.sequence;
    session.authorizedUsageAtomic = next;
    return { accepted: true, session, duplicate: false };
  }

  beginClose(sessionId: string): SessionRecord {
    const session = this.require(sessionId);
    session.closeState = "closing";
    return session;
  }

  interruptClose(sessionId: string): SessionRecord {
    const session = this.require(sessionId);
    session.closeState = "close_interrupted";
    session.unusedFundsState = "unknown";
    return session;
  }

  close(sessionId: string): MppSessionReceipt {
    const session = this.require(sessionId);
    const unused = session.fundedAtomic - session.authorizedUsageAtomic;
    session.settledAtomic = session.authorizedUsageAtomic;
    session.closeState = "closed";
    session.unusedFundsState = "returned";
    return {
      sessionId,
      settledAtomic: session.settledAtomic.toString(),
      unusedAtomic: unused.toString(),
      closeState: "closed",
      unusedFundsState: "returned",
      settlementKind: this.pins.settlementMode === "testnet" ? "network" : "simulated",
    };
  }

  get(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  challengeHeaders(challenge: MppSessionChallenge): Record<string, string> {
    return { [MPP_HEADERS.session]: encodeMpp(challenge) };
  }

  private require(sessionId: string): SessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Unknown session ${sessionId}`);
    return session;
  }
}

export class MppSessionClient {
  constructor(private readonly pins: Pins) {}

  readChallenge(headers: Headers | Record<string, string | undefined>): MppSessionChallenge | null {
    const raw =
      headers instanceof Headers
        ? headers.get(MPP_HEADERS.session)
        : headers[MPP_HEADERS.session] ?? headers[MPP_HEADERS.session.toLowerCase()];
    return decodeMpp<MppSessionChallenge>(raw);
  }

  voucher(input: {
    sessionId: string;
    sequence: number;
    cumulativeAtomic: bigint;
    units: number;
    eventId?: string;
  }): MppVoucher {
    const eventId = input.eventId ?? id("ue");
    return {
      sessionId: input.sessionId,
      sequence: input.sequence,
      cumulativeAtomic: input.cumulativeAtomic.toString(),
      units: input.units,
      eventId,
      signature: hmacHex(
        this.pins.signerSecret,
        [input.sessionId, eventId, input.cumulativeAtomic.toString(), String(input.sequence)].join("|"),
      ),
    };
  }
}
