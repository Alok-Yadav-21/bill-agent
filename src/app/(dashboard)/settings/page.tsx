"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "@/lib/household-context";

interface Budget {
  id: string;
  amountMinor: number;
  currency: string;
  periodType: "MONTHLY" | "WEEKLY" | "CUSTOM";
  startDate: string;
  endDate: string;
  amountFormatted: string;
}

type Period = "MONTHLY" | "WEEKLY" | "CUSTOM";

export default function SettingsPage() {
  const { current } = useHousehold();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [budget, setBudget] = useState<Budget | null>(null);

  // form fields
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<Period>("MONTHLY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function load() {
    if (!current) return;
    setState("loading");
    try {
      const res = await fetch(`/api/budget?householdId=${current.id}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Failed");
      const b: Budget | null = json.data;
      setBudget(b);
      if (b) {
        setAmount((b.amountMinor / 100).toFixed(2));
        setPeriod(b.periodType);
        setStartDate(b.startDate.slice(0, 10));
        setEndDate(b.endDate.slice(0, 10));
      }
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function flash(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }

  async function save(mode: "update" | "new") {
    setBusy(true);
    try {
      const method = mode === "update" ? "PATCH" : "POST";
      const payload =
        mode === "update"
          ? { budgetId: budget!.id, amount, periodType: period, startDate, endDate }
          : { amount, periodType: period, startDate, endDate };

      const res = await fetch(`/api/budget?householdId=${current!.id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        if (json.error?.code === "FORBIDDEN") {
          flash("err", "Only an admin can change the budget.");
        } else {
          flash("err", json.error?.message ?? "Could not save.");
        }
        return;
      }
      flash("ok", mode === "update" ? "Budget updated." : "New budget period created.");
      await load();
    } catch {
      flash("err", "Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <div className="max-w-xl"><div className="h-48 animate-pulse rounded-xl bg-[var(--border)]" /></div>;
  if (state === "error")
    return <Panel><p className="text-sm text-[var(--muted)]">Couldn&apos;t load settings. Try refreshing.</p></Panel>;

  const amountValid = Number(amount) > 0;
  const datesValid = !!startDate && !!endDate && startDate <= endDate;
  const canSubmit = amountValid && datesValid && !busy;

  return (
    <div className="max-w-xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Manage your household budget.</p>
      </header>

      {toast && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: toast.kind === "ok" ? "var(--accent)" : "var(--danger)",
            color: toast.kind === "ok" ? "var(--accent)" : "var(--danger)",
            background: "#fff",
          }}
        >
          {toast.text}
        </div>
      )}

      <Panel>
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Budget</h2>
          {budget && (
            <span className="tabular text-sm text-[var(--muted)]">
              Currently {budget.amountFormatted}
            </span>
          )}
        </div>

        <label className="mt-4 block">
          <span className="text-sm text-[var(--muted)]">Amount (£)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tabular mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            style={{ borderColor: "var(--border)" }}
            placeholder="5000.00"
          />
          {!amountValid && amount !== "" && (
            <span className="mt-1 block text-xs text-[var(--danger)]">Amount must be greater than 0.</span>
          )}
        </label>

        <label className="mt-4 block">
          <span className="text-sm text-[var(--muted)]">Period</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="WEEKLY">Weekly</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-[var(--muted)]">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
          <label className="block">
            <span className="text-sm text-[var(--muted)]">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
        </div>
        {!datesValid && startDate && endDate && (
          <span className="mt-1 block text-xs text-[var(--danger)]">End date must be on or after the start date.</span>
        )}

        {budget ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => save("update")}
              disabled={!canSubmit}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={() => save("new")}
              disabled={!canSubmit}
              className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-60"
              style={{ borderColor: "var(--border)" }}
            >
              Start new period
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <button
              onClick={() => save("new")}
              disabled={!canSubmit}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create budget"}
            </button>
          </div>
        )}

        <p className="mt-4 text-xs text-[var(--muted)]">
          <strong>Save changes</strong> edits the current budget in place. <strong>Start new period</strong>{" "}
          keeps this one in history and begins a fresh period — your past expenses are never deleted.
        </p>
      </Panel>

      <DangerZone householdId={current?.id} householdName={current?.name} isAdmin={current?.role === "ADMIN"} />
    </div>
  );
}

function DangerZone({ householdId, householdName, isAdmin }: { householdId?: string; householdName?: string; isAdmin?: boolean }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  if (!isAdmin || !householdId) return null;

  async function reset() {
    if (!confirm) return;
    if (!window.confirm("This permanently clears all financial records for this household. Members are kept. Continue?")) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/households/reset?householdId=${householdId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm }),
      }).then((r) => r.json());
      if (!res.ok) { setMsg({ kind: "err", text: res.error?.message ?? "Reset failed." }); return; }
      setMsg({ kind: "ok", text: `Reset complete. Cleared ${res.data.transactions} transactions.` });
      setConfirm("");
      setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: "var(--danger)" }}>
      <h2 className="text-base font-semibold" style={{ color: "var(--danger)" }}>Danger zone</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Reset clears <strong>all transactions, budgets, receipts and custom categories</strong> for this household so you can start fresh.
        Your household and members are kept. This cannot be undone.
      </p>
      <label className="mt-4 block">
        <span className="text-sm text-[var(--muted)]">Type the household name <strong>{householdName}</strong> to confirm</span>
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={householdName}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)" }} />
      </label>
      {msg && <p className="mt-2 text-sm" style={{ color: msg.kind === "ok" ? "var(--accent)" : "var(--danger)" }}>{msg.text}</p>}
      <button onClick={reset} disabled={busy || confirm.trim() !== householdName}
        className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--danger)" }}>
        {busy ? "Resetting…" : "Reset household data"}
      </button>
    </section>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}>
      {children}
    </section>
  );
}
