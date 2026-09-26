"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, formatUsd } from "@/lib/api";

type TaskView = {
  task: {
    id: string;
    goal: string;
    status: string;
    preferredLookupProtocol: string;
    supplierIds: string[];
  };
  budget: {
    available_atomic: string;
    reserved_atomic: string;
    completed_spend_atomic: string;
    budget_atomic: string;
    session_locked_atomic: string;
    session_consumed_atomic: string;
    valuation_note: string;
  };
  invocations: Array<{
    id: string;
    serviceId: string;
    operationKey: string;
    invocationState: string;
    deliveryState: string;
    lastError?: string;
    payment?: {
      protocol: string;
      amountAtomic: string | number;
      settlementState: string;
      settlementKind: string;
      transactionReference?: string;
    };
    result?: { payload: unknown; provenance: unknown };
    events: Array<{ stage: string; protocol: string; redactedPayload: unknown }>;
  }>;
  sessions: Array<{
    id: string;
    closeState: string;
    fundedAtomic: string | number;
    authorizedUsageAtomic: string | number;
    unusedFundsState: string;
  }>;
  report: {
    summary: string;
    comparison: Array<{ name: string; lead_time_days: number; unit_price_usd: number; risk: string }>;
    refusals: Array<{ service_id: string; reason?: string }>;
    cost_breakdown: { service_spend: string; available: string; valuation_note: string };
    sources: Array<{ invocation_id: string; service_id: string; protocol?: string; settlement_kind?: string; displayed_as_network_settlement: boolean }>;
  } | null;
};

function Bar({ label, value, total, color }: { label: string; value: bigint; total: bigint; color: string }) {
  const width = total === 0n ? 0 : Math.min(100, Number((value * 1000n) / total) / 10);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>{formatUsd(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink">
        <div className={`h-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function TaskPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<TaskView | null>(null);
  const [openTrace, setOpenTrace] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const next = await api<TaskView>(`/v1/tasks/${params.id}`);
    setData(next);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Failed to load task"));
  }, [params.id]);

  if (error) return <p className="text-rose-300">{error}</p>;
  if (!data) return <p className="text-slate-400">Loading task…</p>;

  const budget = BigInt(data.budget.budget_atomic);

  return (
    <main className="space-y-8">
      <section className="rounded-3xl border border-line bg-panel p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold">{data.task.status}</p>
            <h1 className="mt-2 text-3xl font-semibold">Research task</h1>
            <p className="mt-3 max-w-3xl text-slate-300">{data.task.goal}</p>
          </div>
          <div className="rounded-2xl border border-line bg-ink px-4 py-3 font-mono text-sm">
            Lookup rail: {data.task.preferredLookupProtocol}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Bar label="Consumed" value={BigInt(data.budget.completed_spend_atomic)} total={budget} color="bg-gold" />
          <Bar label="Reserved" value={BigInt(data.budget.reserved_atomic)} total={budget} color="bg-mint" />
          <Bar label="Available" value={BigInt(data.budget.available_atomic)} total={budget} color="bg-sky-400" />
        </div>
        <p className="mt-4 text-xs text-slate-500">{data.budget.valuation_note}</p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {data.invocations.map((invocation) => (
          <article key={invocation.id} className="rounded-3xl border border-line bg-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{invocation.serviceId}</h2>
              <span className="rounded-full border border-line px-3 py-1 text-xs">{invocation.invocationState}</span>
            </div>
            <p className="mt-2 font-mono text-xs text-slate-500">{invocation.operationKey}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-slate-500">Payment</dt>
                <dd>{invocation.payment?.settlementState ?? "not_started"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Delivery</dt>
                <dd>{invocation.deliveryState}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Protocol</dt>
                <dd>{invocation.payment?.protocol ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Amount</dt>
                <dd>{invocation.payment ? formatUsd(invocation.payment.amountAtomic) : "—"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs">
              Settlement kind: <strong>{invocation.payment?.settlementKind ?? "n/a"}</strong>
              {invocation.payment?.settlementKind === "simulated"
                ? " — not a settled network transaction."
                : invocation.payment?.transactionReference
                  ? ` — ${invocation.payment.transactionReference}`
                  : ""}
            </p>
            {invocation.lastError ? <p className="mt-3 text-sm text-amber-300">{invocation.lastError}</p> : null}
            <button
              className="mt-4 text-sm text-mint"
              onClick={() => setOpenTrace(openTrace === invocation.id ? null : invocation.id)}
            >
              {openTrace === invocation.id ? "Hide protocol trace" : "Show protocol trace"}
            </button>
            {openTrace === invocation.id ? (
              <pre className="mt-3 overflow-auto rounded-2xl bg-ink p-4 text-xs text-slate-300">
                {JSON.stringify(invocation.events, null, 2)}
              </pre>
            ) : null}
          </article>
        ))}
      </section>

      {data.sessions.length ? (
        <section className="rounded-3xl border border-line bg-panel p-6">
          <h2 className="text-xl font-semibold">Metered sessions</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {data.sessions.map((session) => (
              <div key={session.id} className="rounded-2xl border border-line bg-ink p-4 text-sm">
                <div>{session.closeState}</div>
                <div className="mt-2 text-slate-400">
                  Funded {formatUsd(session.fundedAtomic)} · consumed {formatUsd(session.authorizedUsageAtomic)} · unused {session.unusedFundsState}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.report ? (
        <section className="rounded-3xl border border-line bg-panel p-7">
          <h2 className="text-xl font-semibold">Report</h2>
          <p className="mt-3 text-slate-300">{data.report.summary}</p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink text-slate-400">
                <tr>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Lead time</th>
                  <th className="px-4 py-3">Unit price</th>
                  <th className="px-4 py-3">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.report.comparison.map((row) => (
                  <tr key={row.name} className="border-t border-line">
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3">{row.lead_time_days} days</td>
                    <td className="px-4 py-3">${row.unit_price_usd}</td>
                    <td className="px-4 py-3">{row.risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.report.refusals.length ? (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              {data.report.refusals.map((item) => (
                <p key={item.service_id}>{item.service_id}: {item.reason}</p>
              ))}
            </div>
          ) : null}
          <p className="mt-4 text-sm text-slate-400">
            Service spend {data.report.cost_breakdown.service_spend}. Remaining {data.report.cost_breakdown.available}.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            {data.report.sources.map((source) => (
              <li key={source.invocation_id}>
                {source.service_id} via {source.protocol} · {source.settlement_kind}
                {source.displayed_as_network_settlement ? "" : " · simulated rail"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
