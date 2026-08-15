"use client";

import { useCallback, useEffect, useState } from "react";
import { useHousehold } from "@/lib/household-context";

interface ExpenseRow {
  id: string;
  date: string;
  member: string;
  merchant: string | null;
  description: string | null;
  category: string | null;
  amount: string;
  source: string;
  status: string;
}
interface Category { id: string; name: string }
interface Member { userId: string; name: string }

export default function ExpensesPage() {
  const { current } = useHousehold();

  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    if (!current) return;
    const [c, m] = await Promise.all([
      fetch(`/api/categories?householdId=${current.id}`).then((r) => r.json()),
      fetch(`/api/members?householdId=${current.id}`).then((r) => r.json()),
    ]);
    if (c.ok) setCategories(c.data);
    if (m.ok) setMembers(m.data);
  }, [current]);

  const loadExpenses = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    const qs = new URLSearchParams({ householdId: current.id, limit: String(LIMIT), offset: String(offset) });
    if (search) qs.set("merchant", search);
    if (memberId) qs.set("memberId", memberId);
    if (categoryId) qs.set("categoryId", categoryId);
    const res = await fetch(`/api/expenses?${qs.toString()}`).then((r) => r.json());
    if (res.ok) {
      setRows(res.data.expenses);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [current, search, memberId, categoryId, offset]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  async function remove(id: string) {
    if (!current) return;
    if (!confirm("Delete this expense?")) return;
    const res = await fetch(`/api/expenses/${id}?householdId=${current.id}`, { method: "DELETE" }).then((r) => r.json());
    if (res.ok) { setToast("Expense deleted."); loadExpenses(); }
    else setToast(res.error?.message ?? "Could not delete.");
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="max-w-5xl space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">
          Add expense
        </button>
      </header>

      {toast && <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "#fff" }}>{toast}</div>}

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setOffset(0); setSearch(e.target.value); }} placeholder="Search merchant…"
          className="flex-1 min-w-[160px] rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
        <select value={memberId} onChange={(e) => { setOffset(0); setMemberId(e.target.value); }}
          className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
          <option value="">All members</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
        <select value={categoryId} onChange={(e) => { setOffset(0); setCategoryId(e.target.value); }}
          className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <section className="rounded-xl border bg-[var(--surface)] overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {loading ? (
          <div className="h-40 animate-pulse bg-[var(--border)]" />
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--muted)]">No expenses yet. Add your first one.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Merchant</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                  <td className="px-4 py-3">{r.member}</td>
                  <td className="px-4 py-3">{r.merchant ?? "—"}<div className="text-xs text-[var(--muted)]">{r.description}</div></td>
                  <td className="px-4 py-3">{r.category ?? "—"}</td>
                  <td className="tabular px-4 py-3 text-right font-medium">{r.amount}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(r.id)} className="text-xs text-[var(--danger)] hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {total > LIMIT && (
        <div className="flex items-center justify-between text-sm text-[var(--muted)]">
          <span>{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))} className="rounded border px-3 py-1 disabled:opacity-40" style={{ borderColor: "var(--border)" }}>Prev</button>
            <button disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)} className="rounded border px-3 py-1 disabled:opacity-40" style={{ borderColor: "var(--border)" }}>Next</button>
          </div>
        </div>
      )}

      {showAdd && current && (
        <AddExpense
          householdId={current.id}
          categories={categories}
          onClose={() => setShowAdd(false)}
          onAdded={(remaining) => { setShowAdd(false); setToast(`Expense added. Remaining: ${remaining ?? "—"}`); setTimeout(() => setToast(null), 3500); setOffset(0); loadExpenses(); }}
        />
      )}
    </div>
  );
}

function AddExpense({ householdId, categories, onClose, onAdded }: {
  householdId: string; categories: Category[]; onClose: () => void; onAdded: (remaining: string | null) => void;
}) {
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/expenses?householdId=${householdId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, merchant: merchant || undefined, description: description || undefined, categoryId: categoryId || undefined, purchaseDate: date }),
      }).then((r) => r.json());
      if (!res.ok) { setError(res.error?.message ?? "Could not add."); return; }
      onAdded(res.data.remaining ?? null);
    } finally { setBusy(false); }
  }

  const valid = Number(amount) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-[var(--surface)] p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold">Add expense</h2>
        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
        <label className="mt-4 block"><span className="text-sm text-[var(--muted)]">Amount (£)</span>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="42.50"
            className="tabular mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} /></label>
        <label className="mt-3 block"><span className="text-sm text-[var(--muted)]">Merchant</span>
          <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Tesco"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} /></label>
        <label className="mt-3 block"><span className="text-sm text-[var(--muted)]">Category</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
            <option value="">Uncategorised</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="mt-3 block"><span className="text-sm text-[var(--muted)]">Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Weekly groceries"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} /></label>
        <label className="mt-3 block"><span className="text-sm text-[var(--muted)]">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} /></label>
        <div className="mt-5 flex gap-2">
          <button onClick={submit} disabled={!valid || busy} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? "Adding…" : "Add expense"}</button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
