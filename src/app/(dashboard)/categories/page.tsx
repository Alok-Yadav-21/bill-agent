"use client";

import { useCallback, useEffect, useState } from "react";
import { useHousehold } from "@/lib/household-context";

interface Category { id: string; name: string; custom: boolean }
interface CategorySpend { categoryId: string | null; spentMinor: number; transactionCount: number }

export default function CategoriesPage() {
  const { current } = useHousehold();
  const [categories, setCategories] = useState<Category[]>([]);
  const [spend, setSpend] = useState<Record<string, { total: number; count: number }>>({});
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    const [cats, dash] = await Promise.all([
      fetch(`/api/categories?householdId=${current.id}`).then((r) => r.json()),
      fetch(`/api/dashboard?householdId=${current.id}`).then((r) => r.json()),
    ]);
    if (cats.ok) setCategories(cats.data);
    if (dash.ok && dash.data.configured) {
      const map: Record<string, { total: number; count: number }> = {};
      (dash.data.topCategories as CategorySpend[]).forEach((c) => {
        if (c.categoryId) map[c.categoryId] = { total: c.spentMinor, count: c.transactionCount };
      });
      setSpend(map);
    }
    setLoading(false);
  }, [current]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!current) return;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/categories?householdId=${current.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    }).then((r) => r.json());
    setBusy(false);
    if (!res.ok) { setMsg(res.error?.message ?? "Could not add."); return; }
    setName(""); setMsg("Category added."); load();
    setTimeout(() => setMsg(null), 2500);
  }

  const fmt = (minor: number) => "£" + (minor / 100).toFixed(2);

  if (loading) return <div className="max-w-3xl"><div className="h-40 animate-pulse rounded-xl bg-[var(--border)]" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <header><h1 className="text-xl font-semibold">Categories</h1></header>

      <section className="rounded-xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-base font-semibold">Add a category</h2>
        <div className="mt-3 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Childcare"
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
          <button onClick={add} disabled={busy || !name} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Add</button>
        </div>
        {msg && <p className="mt-2 text-sm text-[var(--accent)]">{msg}</p>}
      </section>

      <section className="rounded-xl border bg-[var(--surface)] overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[var(--muted)]">
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium text-right">Spent</th>
            <th className="px-4 py-3 font-medium text-right">Transactions</th>
          </tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{c.custom ? "Custom" : "Default"}</td>
                <td className="tabular px-4 py-3 text-right">{spend[c.id] ? fmt(spend[c.id].total) : "£0.00"}</td>
                <td className="tabular px-4 py-3 text-right">{spend[c.id]?.count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
