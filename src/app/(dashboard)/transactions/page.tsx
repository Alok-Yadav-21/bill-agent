"use client";

import { useCallback, useEffect, useState } from "react";
import { useHousehold } from "@/lib/household-context";

interface Txn {
  id: string; date: string; type: string; status: string;
  member: string; counterparty: string | null;
  merchant: string | null; description: string | null; category: string | null;
  amount: string; isCredit: boolean; voidReason: string | null;
}
interface Category { id: string; name: string }
interface Member { userId: string; name: string; role: string }

const TYPE_LABEL: Record<string, string> = {
  CONTRIBUTION: "Contribution", EXPENSE: "Expense", TRANSFER: "Transfer",
  REFUND: "Refund", ADJUSTMENT: "Adjustment",
};
const IN_TYPES = new Set(["CONTRIBUTION", "REFUND"]);

export default function TransactionsPage() {
  const { current } = useHousehold();
  const isManager = current?.role === "ADMIN" || current?.role === "MANAGER";

  const [rows, setRows] = useState<Txn[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [fType, setFType] = useState("");
  const [fMember, setFMember] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const [showAdd, setShowAdd] = useState<null | string>(null); // holds default type
  const [toast, setToast] = useState<string | null>(null);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3500); };

  const loadLists = useCallback(async () => {
    if (!current) return;
    const [c, m] = await Promise.all([
      fetch(`/api/categories?householdId=${current.id}`).then((r) => r.json()),
      fetch(`/api/members?householdId=${current.id}`).then((r) => r.json()),
    ]);
    if (c.ok) setCategories(c.data);
    if (m.ok) setMembers(m.data);
  }, [current]);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    const qs = new URLSearchParams({ householdId: current.id, limit: String(LIMIT), offset: String(offset) });
    if (fType) qs.set("type", fType);
    if (fMember) qs.set("memberId", fMember);
    if (fStatus) qs.set("status", fStatus);
    if (search) qs.set("search", search);
    const res = await fetch(`/api/transactions?${qs}`).then((r) => r.json());
    if (res.ok) { setRows(res.data.transactions); setTotal(res.data.total); }
    setLoading(false);
  }, [current, fType, fMember, fStatus, search, offset]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { load(); }, [load]);

  async function voidTxn(id: string) {
    if (!current) return;
    const reason = prompt("Reason for voiding this transaction?");
    if (!reason) return;
    const res = await fetch(`/api/transactions/${id}/void?householdId=${current.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
    }).then((r) => r.json());
    if (res.ok) { flash("Transaction voided."); load(); } else flash(res.error?.message ?? "Could not void.");
  }

  return (
    <div className="max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowAdd("CONTRIBUTION")} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">+ Money in</button>
          <button onClick={() => setShowAdd("EXPENSE")} className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)" }}>+ Expense</button>
          {isManager && <button onClick={() => setShowAdd("TRANSFER")} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>Transfer</button>}
        </div>
      </header>

      {toast && <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "#fff" }}>{toast}</div>}

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setOffset(0); setSearch(e.target.value); }} placeholder="Search…"
          className="flex-1 min-w-[140px] rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
        <select value={fType} onChange={(e) => { setOffset(0); setFType(e.target.value); }} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={fMember} onChange={(e) => { setOffset(0); setFMember(e.target.value); }} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
          <option value="">All members</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => { setOffset(0); setFStatus(e.target.value); }} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
          <option value="">All statuses</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PENDING">Pending</option>
          <option value="VOID">Void</option>
        </select>
      </div>

      <section className="rounded-xl border bg-[var(--surface)] overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {loading ? <div className="h-40 animate-pulse bg-[var(--border)]" />
          : rows.length === 0 ? <div className="p-8 text-center text-sm text-[var(--muted)]">No transactions yet.</div>
          : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[var(--muted)]">
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Member</th>
                <th className="px-3 py-3 font-medium">Details</th>
                <th className="px-3 py-3 font-medium text-right">Amount</th>
                <th className="px-3 py-3 font-medium"></th>
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const inflow = IN_TYPES.has(r.type) || (r.type === "ADJUSTMENT" && r.isCredit);
                  const isVoid = r.status === "VOID";
                  return (
                    <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)", opacity: isVoid ? 0.5 : 1 }}>
                      <td className="px-3 py-3 whitespace-nowrap">{new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                      <td className="px-3 py-3"><span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--accent-weak)" }}>{TYPE_LABEL[r.type]}</span></td>
                      <td className="px-3 py-3">{r.member}{r.counterparty ? ` → ${r.counterparty}` : ""}</td>
                      <td className="px-3 py-3">{r.merchant ?? r.description ?? r.category ?? "—"}{r.status === "PENDING" && <span className="ml-1 text-xs text-[var(--warn)]">(pending)</span>}{isVoid && <span className="ml-1 text-xs text-[var(--danger)]">(void)</span>}</td>
                      <td className="tabular px-3 py-3 text-right font-medium" style={{ color: isVoid ? "var(--muted)" : inflow ? "var(--accent)" : "var(--ink)" }}>{inflow ? "+" : "−"}{r.amount}</td>
                      <td className="px-3 py-3 text-right">{!isVoid && <button onClick={() => voidTxn(r.id)} className="text-xs text-[var(--danger)] hover:underline">Void</button>}</td>
                    </tr>
                  );
                })}
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
        <AddTxn defaultType={showAdd} householdId={current.id} categories={categories} members={members} isManager={isManager}
          onClose={() => setShowAdd(null)}
          onAdded={(bal) => { setShowAdd(null); flash(`Saved. Available balance: ${bal ?? "—"}`); setOffset(0); load(); }} />
      )}
    </div>
  );
}

function AddTxn({ defaultType, householdId, categories, members, isManager, onClose, onAdded }: {
  defaultType: string; householdId: string; categories: Category[]; members: Member[]; isManager: boolean;
  onClose: () => void; onAdded: (bal: string | null) => void;
}) {
  const [type, setType] = useState(defaultType);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [isCredit, setIsCredit] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const managerTypes = ["TRANSFER", "REFUND", "ADJUSTMENT"];
  const availableTypes = isManager ? ["CONTRIBUTION", "EXPENSE", ...managerTypes] : ["CONTRIBUTION", "EXPENSE"];

  async function submit() {
    setBusy(true); setError(null);
    try {
      const payload: Record<string, unknown> = {
        type, amount,
        merchant: merchant || undefined,
        description: description || undefined,
        occurredAt: date,
      };
      if (type === "EXPENSE") payload.categoryId = categoryId || undefined;
      if (type === "TRANSFER") payload.counterpartyUserId = counterparty || undefined;
      if (type === "ADJUSTMENT") payload.isCredit = isCredit;
      const res = await fetch(`/api/transactions?householdId=${householdId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (!res.ok) { setError(res.error?.message ?? "Could not save."); return; }
      onAdded(res.data.availableBalance ?? null);
    } finally { setBusy(false); }
  }

  const valid = Number(amount) > 0 && (type !== "TRANSFER" || counterparty);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-[var(--surface)] p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold">Add transaction</h2>
        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

        <label className="mt-4 block"><span className="text-sm text-[var(--muted)]">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
            {availableTypes.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select></label>

        <label className="mt-3 block"><span className="text-sm text-[var(--muted)]">Amount (£)</span>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50.00"
            className="tabular mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} /></label>

        {type === "TRANSFER" && (
          <label className="mt-3 block"><span className="text-sm text-[var(--muted)]">To member</span>
            <select value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              <option value="">Select…</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </select></label>
        )}

        {type === "EXPENSE" && (
          <label className="mt-3 block"><span className="text-sm text-[var(--muted)]">Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
        )}

        {type === "ADJUSTMENT" && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isCredit} onChange={(e) => setIsCredit(e.target.checked)} />
            <span>Credit (adds to balance). Uncheck for a debit.</span>
          </label>
        )}

        <label className="mt-3 block"><span className="text-sm text-[var(--muted)]">{type === "EXPENSE" ? "Merchant" : "Note"}</span>
          <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder={type === "EXPENSE" ? "Tesco" : "e.g. August rent share"}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} /></label>

        <label className="mt-3 block"><span className="text-sm text-[var(--muted)]">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} /></label>

        <div className="mt-5 flex gap-2">
          <button onClick={submit} disabled={!valid || busy} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
