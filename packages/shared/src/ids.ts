import { randomBytes, createHash } from "node:crypto";

export function id(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export function paymentId(operationKey: string): string {
  return `pay_${createHash("sha256").update(operationKey).digest("hex").slice(0, 32)}`;
}

export function operationKey(parts: {
  taskId: string;
  serviceId: string;
  businessKey: string;
}): string {
  return [parts.taskId, parts.serviceId, parts.businessKey].join(":");
}
