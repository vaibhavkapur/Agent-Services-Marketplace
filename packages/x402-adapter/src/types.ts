export type X402Accept = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
};

export type X402PaymentRequired = {
  x402Version: 2;
  error: string;
  resource: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts: X402Accept[];
  extensions: {
    "payment-identifier"?: { supported: true };
  };
};

export type X402PaymentPayload = {
  x402Version: 2;
  resource: X402PaymentRequired["resource"];
  accepted: X402Accept;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
      operationKey: string;
    };
  };
  extensions: {
    "payment-identifier"?: { paymentId: string };
  };
};

export type X402SettlementResponse = {
  success: boolean;
  transaction?: string;
  network: string;
  payer?: string;
  errorReason?: string;
  settlementKind: "simulated" | "network";
};
