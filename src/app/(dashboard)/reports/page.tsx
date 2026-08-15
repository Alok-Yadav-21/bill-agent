"use client";

import { useCallback, useEffect, useState } from "react";
import { useHousehold } from "@/lib/household-context";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface Dash {
  configured: boolean;
  budget?: { total: string; spent: string; remaining: string; percentUsed: number };
  topCategories?: { categoryId: string | null; totalMinor: number }[];
}
interface Member { name: string; spent: string }

const COLORS = ["#1f6f5c", "#2f9e79", "#57b894", "#8fd3b6", "#b8e2ce", "#d9efe3"];

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
  if (!dash?.configured) return <div className="rounded-xl border bg-[var(--surface)] p-6 text-sm text-[var(--muted)]" style={{ borderColor: "var(--border)" }}>Set a budget to see reports.</div>;

  const catData = (dash.topCategories ?? [])
    .filter((c) => c.totalMinor > 0)
    .map((c) => ({ name: c.categoryId ? catNames[c.categoryId] ?? "Unknown" : "Uncategorised", value: c.totalMinor / 100 }));

  const memberData = members
    .map((m) => ({ name: m.name, value: Number(m.spent.replace(/[£,]/g, "")) }))
    .filter((m) => m.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="max-w-4xl space-y-6">
      <header><h1 className="text-xl font-semibold">Reports</h1></header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total budget" value={dash.budget!.total} />
        <Stat label="Spent" value={dash.budget!.spent} />
        <Stat label="Remaining" value={dash.budget!.remaining} />
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

        <Panel title="Spending by member">
          {memberData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={memberData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `£${v.toFixed(2)}`} />
                <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-[var(--surface)] p-4" style={{ borderColor: "var(--border)" }}>
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}>
      <h2 className="mb-3 text-base font-semibold">{title}</h2>{children}
    </section>
  );
}
function Empty() { return <div className="flex h-[260px] items-center justify-center text-sm text-[var(--muted)]">No spending yet.</div>; }
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
