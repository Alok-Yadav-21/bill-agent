"use client";

import { useState } from "react";
import { useHousehold } from "@/lib/household-context";

interface Extracted {
  merchant: string | null;
  date: string | null;
  totalMinor: number | null;
  suggestedCategory: string | null;
  items: { name: string; amountMinor: number }[];
  warnings: string[];
}

export default function ScanPage() {
  const { current } = useHousehold();
  const [stage, setStage] = useState<"upload" | "processing" | "confirm" | "done">("upload");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  // editable confirm fields
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<string | null>(null);

  async function upload(file: File) {
    if (!current) return;
    setError(null); setNotConfigured(false); setStage("processing");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/receipts/process?householdId=${current.id}`, { method: "POST", body: form }).then((r) => r.json());
    if (!res.ok) {
      if (res.error?.code === "RECEIPT_UNAVAILABLE") setNotConfigured(true);
      else setError(res.error?.message ?? "Could not process the receipt.");
      setStage("upload");
      return;
    }
    const ex: Extracted = res.data.extracted;
    setReceiptId(res.data.receiptId);
    setExtracted(ex);
    setAmount(ex.totalMinor != null ? (ex.totalMinor / 100).toFixed(2) : "");
    setMerchant(ex.merchant ?? "");
    setDate(ex.date ?? new Date().toISOString().slice(0, 10));
    setStage("confirm");
  }

  async function confirm() {
    if (!current || !receiptId) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/receipts/confirm?householdId=${current.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptId, amount, merchant: merchant || undefined, purchaseDate: date }),
    }).then((r) => r.json());
    setBusy(false);
    if (!res.ok) { setError(res.error?.message ?? "Could not save expense."); return; }
    setRemaining(res.data.remaining ?? null);
    setStage("done");
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header><h1 className="text-xl font-semibold">Scan Receipt</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Upload a photo — we extract the details for you to confirm.</p></header>

      {error && <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "#fff" }}>{error}</div>}

      {notConfigured && (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--warn)", color: "var(--warn)", background: "#fff" }}>
          Receipt scanning isn&apos;t set up yet (it needs an AI/OCR provider). You can still add this expense manually on the Expenses page. See <code>docs/receipt-scanning.md</code> to enable it.
        </div>
      )}

      {stage === "upload" && (
        <label className="flex h-56 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center" style={{ borderColor: "var(--border)" }}>
          <span className="text-4xl">🧾</span>
          <span className="mt-2 text-sm font-medium">Tap to upload or take a photo</span>
          <span className="mt-1 text-xs text-[var(--muted)]">JPEG, PNG or WEBP · up to 8MB</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      )}

      {stage === "processing" && (
        <div className="flex h-56 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm text-[var(--muted)]">Reading your receipt…</span>
        </div>
      )}

      {stage === "confirm" && extracted && (
        <div className="rounded-xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold">Confirm expense</h2>
          {extracted.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--warn)" }}>
              {extracted.warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
            </ul>
          )}
          <label className="mt-4 block"><span className="text-sm text-[var(--muted)]">Total (£)</span>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="tabular mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} /></label>
          <label className="mt-3 block"><span className="text-sm text-[var(--muted)]">Merchant</span>
            <input value={merchant} onChange={(e) => setMerchant(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} /></label>
          <label className="mt-3 block"><span className="text-sm text-[var(--muted)]">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} /></label>
          {extracted.items.length > 0 && (
            <div className="mt-3 text-xs text-[var(--muted)]">
              Items: {extracted.items.map((it) => `${it.name} £${(it.amountMinor / 100).toFixed(2)}`).join(", ")}
            </div>
          )}
          <div className="mt-5 flex gap-2">
            <button onClick={confirm} disabled={busy || !(Number(amount) > 0)} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? "Saving…" : "Confirm expense"}</button>
            <button onClick={() => setStage("upload")} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}>Cancel</button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="rounded-xl border bg-[var(--surface)] p-6 text-center" style={{ borderColor: "var(--border)" }}>
          <div className="text-3xl">✅</div>
          <p className="mt-2 text-sm font-medium">Expense added.</p>
          {remaining && <p className="mt-1 text-sm text-[var(--muted)]">Remaining budget: {remaining}</p>}
          <button onClick={() => { setStage("upload"); setExtracted(null); setReceiptId(null); }} className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">Scan another</button>
        </div>
      )}
    </div>
  );
}
