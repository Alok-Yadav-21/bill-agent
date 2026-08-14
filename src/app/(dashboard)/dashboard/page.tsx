"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  configured: boolean;
  budget?: {
    total: string;
    spent: string;
    remaining: string;
    percentUsed: number;
    transactions: number;
    averageExpense: string;
    overBudget: boolean;
  };
  alert?: { threshold: number; message: string } | null;
  topMembers?: { userId: string; totalMinor: number; transactionCount: number }[];
  topCategories?: { categoryId: string | null; totalMinor: number }[];
}

// Wire this to the user's selected household (session/context) in a later pass.
const HOUSEHOLD_ID = process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD_ID ?? "";

export default function DashboardPage() {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch(`/api/dashboard?householdId=${HOUSEHOLD_ID}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.error?.message ?? "Failed");
        setData(json.data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  if (state === "loading") return <Skeleton />;
  if (state === "error")
    return (
      <Panel>
        <p className="text-sm text-[var(--muted)]">
          We couldn&apos;t load your dashboard. Check your connection and try again.
        </p>
      </Panel>
    );
  if (!data?.configured || !data.budget)
    return (
      <Panel>
        <h2 className="text-base font-semibold">No budget yet</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          An admin can set a household budget to start tracking spending.
        </p>
      </Panel>
    );

  const b = data.budget;
  const pct = Math.min(b.percentUsed, 100);

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <a href="/scan" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">
          Scan Receipt
        </a>
      </header>

      {data.alert && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: b.overBudget ? "var(--danger)" : "var(--warn)",
            color: b.overBudget ? "var(--danger)" : "var(--warn)",
            background: "#fff",
          }}
        >
          {data.alert.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total budget" value={b.total} />
        <Stat label="Spent" value={b.spent} />
        <Stat label="Remaining" value={b.remaining} emphasis={!b.overBudget} danger={b.overBudget} />
      </div>

      <Panel>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--muted)]">Budget used</span>
          <span className="tabular text-sm font-medium">{b.percentUsed}%</span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: b.overBudget ? "var(--danger)" : "var(--accent)" }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Meta label="Transactions" value={String(b.transactions)} />
          <Meta label="Average expense" value={b.averageExpense} />
          <Meta label="Status" value={b.overBudget ? "Over budget" : "On track"} />
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value, emphasis, danger }: { label: string; value: string; emphasis?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-xl border bg-[var(--surface)] p-4" style={{ borderColor: "var(--border)" }}>
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div
        className="tabular mt-1 text-2xl font-semibold"
        style={{ color: danger ? "var(--danger)" : emphasis ? "var(--accent)" : "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[var(--muted)]">{label}</div>
      <div className="tabular mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}>
      {children}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="max-w-5xl space-y-4">
      <div className="h-7 w-40 animate-pulse rounded bg-[var(--border)]" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--border)]" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-[var(--border)]" />
    </div>
  );
}
