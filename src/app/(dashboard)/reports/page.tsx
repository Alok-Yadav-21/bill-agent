"use client";

import { useCallback, useEffect, useState } from "react";
import { useHousehold } from "@/lib/household-context";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface Dash {
  configured: boolean;
  balance?: { available: string; contributions: string; expenses: string };
  topCategories?: { categoryId: string | null; spentMinor: number }[];
}
interface Member { name: string; spent: string; contributed: string }

const COLORS = ["#1f6f5c", "#2f9e79", "#57b894", "#8fd3b6", "#b8e2ce", "#d9efe3"];
const toNum = (s: string) => Number(s.replace(/[£,]/g, ""));

export default function ReportsPage() {
  const { current } = useHousehold();
  const [dash, setDash] = useState<Dash | null>(null);
  const [catNames, setCatNames] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    const [d, c, m] = await Promise.all([
      fetch(`/api/dashboard?householdId=${current.id}`).then((r) => r.json()),
      fetch(`/api/categories?householdId=${current.id}`).then((r) => r.json()),
      fetch(`/api/members?householdId=${current.id}`).then((r) => r.json()),
    ]);
    if (d.ok) setDash(d.data);
    if (c.ok) setCatNames(Object.fromEntries((c.data as { id: string; name: string }[]).map((x) => [x.id, x.name])));
    if (m.ok) setMembers(m.data);
    setLoading(false);
  }, [current]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="max-w-4xl"><div className="h-64 animate-pulse rounded-xl bg-[var(--border)]" /></div>;
  if (!dash?.configured || !dash.balance) return <div className="rounded-xl border bg-[var(--surface)] p-6 text-sm text-[var(--muted)]" style={{ borderColor: "var(--border)" }}>Add some transactions to see reports.</div>;

  const catData = (dash.topCategories ?? [])
    .filter((c) => c.spentMinor > 0)
    .map((c) => ({ name: c.categoryId ? catNames[c.categoryId] ?? "Unknown" : "Uncategorised", value: c.spentMinor / 100 }));

  const spendData = members.map((m) => ({ name: m.name, value: toNum(m.spent) })).filter((m) => m.value > 0).sort((a, b) => b.value - a.value);
  const contribData = members.map((m) => ({ name: m.name, value: toNum(m.contributed) })).filter((m) => m.value > 0).sort((a, b) => b.value - a.value);

  return (
    <div className="max-w-4xl space-y-6">
      <header><h1 className="text-xl font-semibold">Reports</h1></header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Available balance" value={dash.balance.available} accent />
        <Stat label="Total contributed" value={dash.balance.contributions} />
        <Stat label="Total spent" value={dash.balance.expenses} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Spending by category">
          {catData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `£${v.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <Legend items={catData} />
        </Panel>

        <Panel title="Contributions by member">
          {contribData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={contribData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `£${v.toFixed(2)}`} />
                <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Spending by member">
          {spendData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={spendData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `£${v.toFixed(2)}`} />
                <Bar dataKey="value" fill="#8fd3b6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
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
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}><h2 className="mb-3 text-base font-semibold">{title}</h2>{children}</section>;
}
function Empty() { return <div className="flex h-[260px] items-center justify-center text-sm text-[var(--muted)]">No data yet.</div>; }
function Legend({ items }: { items: { name: string; value: number }[] }) {
  return (
    <ul className="mt-3 space-y-1 text-sm">
      {items.map((it, i) => (
        <li key={it.name} className="flex items-center justify-between">
          <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />{it.name}</span>
          <span className="tabular text-[var(--muted)]">£{it.value.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}
