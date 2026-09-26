import type { TaskRow } from "@asm/db";
import { formatAtomic, type BudgetSnapshot } from "@asm/shared";
import { store } from "./coordinator.js";

export function buildReport(task: TaskRow, budget: BudgetSnapshot) {
  const invocations = store.listInvocations(task.id);
  const sessions = store.listSessions(task.id);
  const sources = invocations
    .filter((invocation) => invocation.resultReference)
    .map((invocation) => {
      const result = store.getResultByInvocation(invocation.id);
      const payment = store.latestPayment(invocation.id);
      return {
        invocation_id: invocation.id,
        service_id: invocation.serviceId,
        protocol: payment?.protocol,
        settlement_kind: payment?.settlementKind,
        transaction_reference: payment?.transactionReference ?? null,
        payload: result?.payload,
      };
    });
  const refusals = invocations
    .filter((invocation) => invocation.invocationState === "rejected")
    .map((invocation) => ({
      service_id: invocation.serviceId,
      reason: invocation.lastError,
    }));
  const profiles = sources
    .map((source) => (source.payload as { supplier?: { id: string; name: string; lead_time_days: number; unit_price_usd: number; risk: string; on_time_rate: number } })?.supplier)
    .filter(Boolean) as Array<{ id: string; name: string; lead_time_days: number; unit_price_usd: number; risk: string; on_time_rate: number }>;

  const ranked = [...profiles].sort((a, b) => a.lead_time_days - b.lead_time_days);
  const body = {
    goal: task.goal,
    summary:
      ranked.length === 0
        ? "No purchased supplier evidence was available."
        : `${ranked[0]!.name} has the shortest advertised lead time among purchased profiles.`,
    comparison: ranked,
    refusals,
    sessions: sessions.map((session) => ({
      id: session.id,
      close_state: session.closeState,
      funded_atomic: session.fundedAtomic.toString(),
      consumed_atomic: session.authorizedUsageAtomic.toString(),
      unused_funds_state: session.unusedFundsState,
    })),
    cost_breakdown: {
      valuation_note: budget.valuation_note,
      service_spend: `${formatAtomic(BigInt(budget.completed_spend_atomic))} ${budget.asset}`,
      reserved: `${formatAtomic(BigInt(budget.reserved_atomic))} ${budget.asset}`,
      available: `${formatAtomic(BigInt(budget.available_atomic))} ${budget.asset}`,
      network_fees: "Tracked separately from the $2 service-charge cap.",
    },
    sources: sources.map((source) => ({
      invocation_id: source.invocation_id,
      service_id: source.service_id,
      protocol: source.protocol,
      settlement_kind: source.settlement_kind,
      displayed_as_network_settlement: source.settlement_kind === "network",
    })),
  };
  store.putReport({ taskId: task.id, body });
  return body;
}
