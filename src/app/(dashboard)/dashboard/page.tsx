"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "@/lib/household-context";

interface DashboardData {
  configured: boolean;
  balance?: {
    available: string; availableMinor: number; contributions: string; expenses: string;
    transactions: number; negative: boolean;
  };
  budget?: { total: string; spent: string; percentUsed: number; overBudget: boolean } | null;
  alert?: { threshold: number; message: string } | null;
}

export default function DashboardPage() {
  const { current } = useHousehold();
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!current) return;
    setState("loading");
    fetch(`/api/dashboard?householdId=${current.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.error?.message ?? "Failed");
        setData(json.data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [current]);

  if (state === "loading") return <Skeleton />;
  if (state === "error")
    return <Panel><p className="text-sm text-[var(--muted)]">We couldn&apos;t load your dashboard. Try again.</p></Panel>;
  if (!data?.configured || !data.balance)
    return <Panel><h2 className="text-base font-semibold">Nothing here yet</h2><p className="mt-1 text-sm text-[var(--muted)]">Add a contribution or expense to get started.</p></Panel>;

  const b = data.balance;
  const bud = data.budget;
  const pct = bud ? Math.min(bud.percentUsed, 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <a href="/scan" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">Scan Receipt</a>
      </header>

      {data.alert && (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: bud?.overBudget ? "var(--danger)" : "var(--warn)", color: bud?.overBudget ? "var(--danger)" : "var(--warn)", background: "#fff" }}>
          {data.alert.message}
        </div>
      )}

      <div className="rounded-xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}>
        <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Available balance</div>
        <div className="tabular mt-1 text-4xl font-semibold" style={{ color: b.negative ? "var(--danger)" : "var(--accent)" }}>{b.available}</div>
        <div className="mt-1 text-sm text-[var(--muted)]">{b.transactions} confirmed transactions</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Total contributed" value={b.contributions} accent />
        <Stat label="Total spent" value={b.expenses} />
      </div>

      {bud && (
        <Panel>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-[var(--muted)]">Monthly budget used</span>
            <span className="tabular text-sm font-medium">{bud.percentUsed}%</span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[var(--border)]">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: bud.overBudget ? "var(--danger)" : "var(--accent)" }} />
          </div>
          <div className="mt-3 text-sm text-[var(--muted)]">{bud.spent} of {bud.total} {bud.overBudget ? "— over budget" : ""}</div>
        </Panel>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-[var(--surface)] p-4" style={{ borderColor: "var(--border)" }}>
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold" style={{ color: accent ? "var(--accent)" : "var(--ink)" }}>{value}</div>
    </div>
  );
}
function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}>{children}</section>;
}
function Skeleton() {
  return (
    <div className="max-w-5xl space-y-4">
      <div className="h-7 w-40 animate-pulse rounded bg-[var(--border)]" />
      <div className="h-28 animate-pulse rounded-xl bg-[var(--border)]" />
      <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--border)]" />)}</div>
    </div>
  );
}
