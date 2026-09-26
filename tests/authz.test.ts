import { describe, expect, it } from "vitest";
import { IsolatedSigner } from "@asm/signer-interface";
import { loadPins } from "@asm/shared";

const pins = loadPins();

describe("isolated signer authority", () => {
  it("refuses to sign a payee that is not the registered operator", () => {
    const signer = new IsolatedSigner(pins, ["localhost:3002"]);
    expect(() =>
      signer.sign({
        protocol: "x402",
        operationKey: "op",
        resourceHost: "localhost:3002",
        terms: {
          asset: pins.x402.asset,
          network: pins.x402.network,
          amountAtomic: "20000",
          payTo: "0x9999999999999999999999999999999999999999",
          expiresAt: Math.floor(Date.now() / 1000) + 30,
          resource: "http://localhost:3002/v1/suppliers/s1",
        },
      }),
    ).toThrow(/payee/i);
  });
});
