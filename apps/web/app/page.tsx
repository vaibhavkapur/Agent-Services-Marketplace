"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

const SUPPLIERS = ["s1", "s2", "s3", "s4", "s5"];

const DEMOS = [
  {
    id: "A",
    title: "Paid research",
    blurb: "Buy five lookups, then produce a sourced comparison.",
    protocol: "x402" as const,
    services: ["supplier_lookup", "document_extraction"],
    fault: "none",
  },
  {
    id: "B",
    title: "Budget refusal",
    blurb: "Attempt a $1.95 diligence memo after cheaper lookups.",
    protocol: "x402" as const,
    services: ["supplier_lookup", "supplier_diligence"],
    fault: "none",
  },
  {
    id: "C",
    title: "Response recovery",
    blurb: "Drop the first paid response, then recover without a second charge.",
    protocol: "x402" as const,
    services: ["supplier_lookup"],
    fault: "drop-after-payment",
  },
  {
    id: "D",
    title: "Metered session",
    blurb: "Extract pages, interrupt close, then reconcile unused funds.",
    protocol: "mpp" as const,
    services: ["supplier_lookup", "document_extraction"],
    fault: "interrupt-session",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [goal, setGoal] = useState("Research these five suppliers and prepare a comparison. You may spend up to $2 on external data.");
  const [protocol, setProtocol] = useState<"x402" | "mpp">("x402");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createAndRun(input?: { protocol?: "x402" | "mpp"; services?: string[]; fault?: string }) {
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ task: { id: string } }>("/v1/tasks", {
        method: "POST",
        body: JSON.stringify({
          goal,
          supplier_ids: SUPPLIERS,
          budget: {
            asset: "USDC",
            amount_atomic: "2000000",
            decimals: 6,
            scope: "service_charges",
          },
          allowed_services: input?.services ?? ["supplier_lookup", "document_extraction"],
          preferred_lookup_protocol: input?.protocol ?? protocol,
        }),
      });
      await api(`/v1/tasks/${created.task.id}/run`, {
        method: "POST",
        body: JSON.stringify({ fault: input?.fault ?? "none" }),
      });
      router.push(`/tasks/${created.task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start task");
      setBusy(false);
    }
  }

  return (
    <main className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-3xl border border-line bg-panel/90 p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-mint">Research desk</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight">
          The agent buys the evidence it needs, then accounts for every charge.
        </h1>
        <p className="mt-4 max-w-xl text-slate-300">
          Discover services over MCP, pay with x402 exact or MPP charge/session, reserve a $2 service-charge budget, and keep settlement separate from delivery.
        </p>
        <label className="mt-8 block text-sm text-slate-400">Task goal</label>
        <textarea
          className="mt-2 h-32 w-full rounded-2xl border border-line bg-ink p-4 text-sm"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            className="rounded-full border border-line bg-ink px-4 py-2 text-sm"
            value={protocol}
            onChange={(event) => setProtocol(event.target.value as "x402" | "mpp")}
          >
            <option value="x402">Lookup via x402 exact</option>
            <option value="mpp">Lookup via MPP charge</option>
          </select>
          <button
            className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            disabled={busy}
            onClick={() => createAndRun()}
          >
            {busy ? "Running…" : "Create and run"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </section>
      <aside className="grid gap-4">
        {DEMOS.map((demo) => (
          <button
            key={demo.id}
            disabled={busy}
            onClick={() => createAndRun(demo)}
            className="rounded-3xl border border-line bg-panel p-5 text-left transition hover:border-gold"
          >
            <div className="text-xs uppercase tracking-[0.18em] text-gold">Demo {demo.id}</div>
            <div className="mt-1 font-semibold">{demo.title}</div>
            <p className="mt-2 text-sm text-slate-400">{demo.blurb}</p>
          </button>
        ))}
      </aside>
    </main>
  );
}
