import type { AssetCode, BudgetSnapshot } from "./types.js";

export const USDC_DECIMALS = 6;
export const TWO_DOLLARS_ATOMIC = 2_000_000n;

export function parseAtomic(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error("atomic amounts must be integers");
    }
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`invalid atomic amount: ${value}`);
  }
  return BigInt(value);
}

export function formatAtomic(amount: bigint, decimals = USDC_DECIMALS): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const padded = abs.toString().padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  const rendered = frac.length ? `${whole}.${frac}` : whole;
  return negative ? `-${rendered}` : rendered;
}

export function availableBudget(input: {
  budget: bigint;
  completed: bigint;
  reserved: bigint;
}): bigint {
  return input.budget - input.completed - input.reserved;
}

export function snapshotFromTotals(input: {
  asset: AssetCode;
  decimals: number;
  budget: bigint;
  completed: bigint;
  reserved: bigint;
  sessionLocked: bigint;
  sessionConsumed: bigint;
  networkFeeAllowance: bigint;
  networkFeeSpent: bigint;
}): BudgetSnapshot {
  return {
    asset: input.asset,
    decimals: input.decimals,
    scope: "service_charges",
    valuation_note:
      "Demo assumption: 1 USDC is labeled as $1. The $2 cap is service charges only; network fees have a separate allowance.",
    budget_atomic: input.budget.toString(),
    completed_spend_atomic: input.completed.toString(),
    reserved_atomic: input.reserved.toString(),
    session_locked_atomic: input.sessionLocked.toString(),
    session_consumed_atomic: input.sessionConsumed.toString(),
    available_atomic: availableBudget({
      budget: input.budget,
      completed: input.completed,
      reserved: input.reserved,
    }).toString(),
    network_fee_allowance_atomic: input.networkFeeAllowance.toString(),
    network_fee_spent_atomic: input.networkFeeSpent.toString(),
  };
}
