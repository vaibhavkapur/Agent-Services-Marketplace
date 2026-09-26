import { digestJson, id } from "@asm/shared";

export type StoredResult = {
  id: string;
  invocationId: string;
  payload: unknown;
  schemaVersion: string;
  checksum: string;
  provenance: {
    serviceId: string;
    protocol: string;
    settlementKind: string;
    purchased: true;
  };
};

export class ResultStore {
  private readonly byInvocation = new Map<string, StoredResult>();
  private readonly byId = new Map<string, StoredResult>();

  put(input: {
    invocationId: string;
    payload: unknown;
    schemaVersion: string;
    serviceId: string;
    protocol: string;
    settlementKind: string;
  }): StoredResult {
    const existing = this.byInvocation.get(input.invocationId);
    if (existing) return existing;
    const record: StoredResult = {
      id: id("res"),
      invocationId: input.invocationId,
      payload: input.payload,
      schemaVersion: input.schemaVersion,
      checksum: digestJson(input.payload),
      provenance: {
        serviceId: input.serviceId,
        protocol: input.protocol,
        settlementKind: input.settlementKind,
        purchased: true,
      },
    };
    this.byInvocation.set(input.invocationId, record);
    this.byId.set(record.id, record);
    return record;
  }

  getByInvocation(invocationId: string): StoredResult | undefined {
    return this.byInvocation.get(invocationId);
  }

  get(idValue: string): StoredResult | undefined {
    return this.byId.get(idValue);
  }
}
