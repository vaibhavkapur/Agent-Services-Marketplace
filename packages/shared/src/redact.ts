const SENSITIVE = /signature|authorization|credential|private|secret|voucher/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE.test(key) ? "[redacted]" : redact(inner);
    }
    return out;
  }
  return value;
}
