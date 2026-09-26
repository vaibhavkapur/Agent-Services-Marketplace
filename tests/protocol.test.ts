import { describe, expect, it } from "vitest";
import { IsolatedSigner } from "@asm/signer-interface";
import { loadPins } from "@asm/shared";
import { X402Client, X402ResourceServer } from "@asm/x402-adapter";
import { MppChargeClient, MppChargeServer, MppSessionClient, MppSessionServer } from "@asm/mpp-adapter";
import { canFallbackProtocol } from "@asm/invocation-domain";
import { validateTerms } from "@asm/budget-policy";

const pins = loadPins();
const signer = new IsolatedSigner(pins, ["localhost:3002"]);

describe("unsupported asset and network", () => {
  it("rejects an altered asset before signing", () => {
    const decision = validateTerms({
      pins,
      allowedHosts: ["localhost:3002"],
      resourceHost: "localhost:3002",
      terms: {
        asset: "0xdead",
        network: pins.x402.network,
        amountAtomic: "20000",
        payTo: pins.payeeAddress,
        expiresAt: Math.floor(Date.now() / 1000) + 30,
        resource: "http://localhost:3002/v1/suppliers/s1",
      },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("unsupported_asset");
  });

  it("rejects expired terms", () => {
    const decision = validateTerms({
      pins,
      allowedHosts: ["localhost:3002"],
      resourceHost: "localhost:3002",
      now: 100,
      terms: {
        asset: pins.x402.asset,
        network: pins.x402.network,
        amountAtomic: "20000",
        payTo: pins.payeeAddress,
        expiresAt: 99,
        resource: "http://localhost:3002/v1/suppliers/s1",
      },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("expired_terms");
  });
});

describe("x402 exact V2", () => {
  it("settles once and replays the same payment-identifier", () => {
    const server = new X402ResourceServer(pins);
    const client = new X402Client(pins, signer);
    const required = server.accept({
      amountAtomic: "20000",
      resourceUrl: "http://localhost:3002/v1/suppliers/s1",
      description: "supplier.lookup",
    });
    const authorized = client.authorize({
      required,
      operationKey: "task:supplier_lookup:s1:x402",
      resourceHost: "localhost:3002",
      advertisedAtomic: "20000",
    });
    const verified = server.verify({
      payload: authorized.payload,
      expectedAmount: "20000",
      expectedResource: "http://localhost:3002/v1/suppliers/s1",
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    const first = server.settle({
      paymentId: verified.paymentId,
      operationKey: verified.operationKey,
      result: { supplier: { id: "s1" } },
    });
    const second = server.settle({
      paymentId: verified.paymentId,
      operationKey: verified.operationKey,
      result: { supplier: { id: "s1-other" } },
    });
    expect(first.replay).toBe(false);
    expect(second.replay).toBe(true);
    expect(second.settlement.settlementKind).toBe("simulated");
    expect(server.recall(verified.paymentId)?.result).toEqual({ supplier: { id: "s1" } });
  });
});

describe("MPP charge", () => {
  it("binds a credential to the challenge and does not create a second charge", () => {
    const server = new MppChargeServer(pins);
    const client = new MppChargeClient(pins, signer);
    const challenge = server.challenge({
      amountAtomic: "20000",
      resource: "http://localhost:3002/v1/suppliers/s1",
    });
    const authorized = client.authorize({
      challenge,
      operationKey: "task:supplier_lookup:s1:mpp",
      resourceHost: "localhost:3002",
      advertisedAtomic: "20000",
    });
    expect(server.verify({ challenge, credential: authorized.credential, expectedAmount: "20000" })).toEqual({ ok: true });
    const first = server.settle({ challenge, result: { ok: true } });
    const second = server.settle({ challenge, result: { ok: false } });
    expect(first.replay).toBe(false);
    expect(second.replay).toBe(true);
  });
});

describe("protocol fallback", () => {
  it("blocks fallback while payment may have succeeded", () => {
    expect(canFallbackProtocol("settlement_pending")).toBe(false);
    expect(canFallbackProtocol("outcome_unknown")).toBe(false);
    expect(canFallbackProtocol("not_started")).toBe(true);
  });
});

describe("metered sessions", () => {
  it("ignores duplicate and out-of-order usage without inflating consumption", () => {
    const server = new MppSessionServer(pins, 10_000n);
    const client = new MppSessionClient(pins);
    const opened = server.open({ suggestedDeposit: "40000", resource: "http://localhost:3003/docs" });
    server.fund(opened.sessionId, 40_000n);
    const first = client.voucher({
      sessionId: opened.sessionId,
      sequence: 1,
      cumulativeAtomic: 20_000n,
      units: 2,
      eventId: "ue_1",
    });
    expect(server.acceptVoucher(first).accepted).toBe(true);
    expect(server.acceptVoucher(first).duplicate).toBe(true);
    expect(() =>
      server.acceptVoucher(
        client.voucher({
          sessionId: opened.sessionId,
          sequence: 4,
          cumulativeAtomic: 40_000n,
          units: 2,
          eventId: "ue_4",
        }),
      ),
    ).toThrow(/out-of-order/i);
    expect(server.get(opened.sessionId)?.authorizedUsageAtomic).toBe(20_000n);
  });

  it("recovers an interrupted close without double-settling", () => {
    const server = new MppSessionServer(pins, 10_000n);
    const client = new MppSessionClient(pins);
    const opened = server.open({ suggestedDeposit: "40000", resource: "http://localhost:3003/docs" });
    server.fund(opened.sessionId, 40_000n);
    server.acceptVoucher(
      client.voucher({
        sessionId: opened.sessionId,
        sequence: 1,
        cumulativeAtomic: 20_000n,
        units: 2,
        eventId: "ue_close",
      }),
    );
    server.interruptClose(opened.sessionId);
    const receipt = server.close(opened.sessionId);
    expect(receipt.settledAtomic).toBe("20000");
    expect(receipt.unusedAtomic).toBe("20000");
    expect(receipt.unusedFundsState).toBe("returned");
  });
});
