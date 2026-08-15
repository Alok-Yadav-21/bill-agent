"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface PendingInvite {
  token: string;
  householdName: string;
  role: "ADMIN" | "MEMBER";
}

export default function OnboardingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenFromLink = params.get("token");

  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // create-household form
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    // If the user already has a household, don't sit on onboarding.
    fetch("/api/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && (json.data.households?.length ?? 0) > 0) {
          router.replace("/dashboard");
          return;
        }
        return fetch("/api/invitations/mine")
          .then((r) => r.json())
          .then((j) => {
            if (j.ok) setInvites(j.data);
            setLoading(false);
          });
      })
      .catch(() => setLoading(false));
  }, [router]);

  // If arriving via an invite link, try to accept it straight away.
  useEffect(() => {
    if (tokenFromLink) void accept(tokenFromLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromLink]);

  async function accept(token: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? "Could not accept invitation.");
        return;
      }
      if (typeof window !== "undefined") localStorage.setItem("currentHouseholdId", json.data.householdId);
      router.replace("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  async function createHousehold() {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { name };
      if (amount && startDate && endDate) {
        payload.budget = { amount, periodType: "MONTHLY", startDate, endDate };
      }
      const res = await fetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? "Could not create household.");
        return;
      }
      if (typeof window !== "undefined") localStorage.setItem("currentHouseholdId", json.data.id);
      router.replace("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto mt-24 max-w-md px-4">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--border)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-md space-y-6 px-4">
      <div className="text-center">
        <div className="text-lg font-semibold">Welcome to Bill Agent</div>
        <p className="mt-1 text-sm text-[var(--muted)]">Set up a household to get started.</p>
      </div>

      {error && (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "#fff" }}>
          {error}
        </div>
      )}

      {invites.length > 0 && (
        <section className="rounded-xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold">Your invitations</h2>
          <ul className="mt-3 space-y-2">
            {invites.map((inv) => (
              <li key={inv.token} className="flex items-center justify-between">
                <span className="text-sm">
                  {inv.householdName} <span className="text-[var(--muted)]">· {inv.role.toLowerCase()}</span>
                </span>
                <button
                  onClick={() => accept(inv.token)}
                  disabled={busy}
                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  Accept
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-base font-semibold">Create a household</h2>
        <label className="mt-4 block">
          <span className="text-sm text-[var(--muted)]">Household name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="London House"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
        </label>

        <p className="mt-4 text-sm font-medium">Starting budget <span className="font-normal text-[var(--muted)]">(optional)</span></p>
        <label className="mt-2 block">
          <span className="text-sm text-[var(--muted)]">Amount (£)</span>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000.00"
            className="tabular mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
        </label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-[var(--muted)]">Start</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
          </label>
          <label className="block">
            <span className="text-sm text-[var(--muted)]">End</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
          </label>
        </div>

        <button
          onClick={createHousehold}
          disabled={busy || name.trim().length === 0}
          className="mt-5 w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create household"}
        </button>
        <p className="mt-3 text-xs text-[var(--muted)]">You'll be the admin and can invite members afterwards.</p>
      </section>
    </div>
  );
}
