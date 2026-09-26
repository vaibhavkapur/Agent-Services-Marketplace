export const MPP_HEADERS = {
  challenge: "MPP-Challenge",
  credential: "MPP-Credential",
  receipt: "MPP-Receipt",
  session: "MPP-Session",
} as const;

export type MppChallenge = {
  method: string;
  challengeId: string;
  amount: string;
  currency: string;
  recipient: string;
  chainId: number;
  resource: string;
  expiresAt: number;
  mode: "proof" | "pull" | "push";
};

export type MppCredential = {
  challengeId: string;
  type: "proof" | "transaction" | "hash";
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
};

export type MppReceipt = {
  challengeId: string;
  success: boolean;
  method: string;
  amount: string;
  currency: string;
  settlementKind: "simulated" | "network";
  transaction?: string;
  errorReason?: string;
};

export type MppSessionChallenge = {
  method: string;
  sessionId: string;
  suggestedDeposit: string;
  currency: string;
  recipient: string;
  chainId: number;
  unitPriceAtomic: string;
  resource: string;
};

export type MppVoucher = {
  sessionId: string;
  sequence: number;
  cumulativeAtomic: string;
  units: number;
  eventId: string;
  signature: string;
};

export type MppSessionReceipt = {
  sessionId: string;
  settledAtomic: string;
  unusedAtomic: string;
  closeState: "closed" | "close_interrupted";
  unusedFundsState: "returned" | "held" | "unknown";
  settlementKind: "simulated" | "network";
};
