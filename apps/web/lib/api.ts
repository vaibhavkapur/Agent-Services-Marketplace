const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-user-id": "demo-user",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? json.message ?? response.statusText);
  }
  return json as T;
}

export function formatUsd(atomic: string | number | bigint, decimals = 6): string {
  const value = BigInt(atomic);
  const padded = value.toString().padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  return frac ? `$${whole}.${frac}` : `$${whole}`;
}
