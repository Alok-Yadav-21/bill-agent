"use client";

import { useCallback, useEffect, useState } from "react";
import { useHousehold } from "@/lib/household-context";

interface Member {
  userId: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  contributed: string;
  spent: string;
  net: string;
  transactions: number;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export default function MembersPage() {
  const { current } = useHousehold();
  const isAdmin = current?.role === "ADMIN";

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    const [mRes, iRes] = await Promise.all([
      fetch(`/api/members?householdId=${current.id}`).then((r) => r.json()),
      fetch(`/api/invitations?householdId=${current.id}`).then((r) => r.json()),
    ]);
    if (mRes.ok) setMembers(mRes.data);
    if (iRes.ok) setInvites(iRes.data);
    setLoading(false);
  }, [current]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  }

  async function invite() {
    if (!current) return;
    setBusy(true);
    setLastLink(null);
    try {
      const res = await fetch(`/api/invitations?householdId=${current.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const json = await res.json();
      if (!json.ok) {
        flash("err", json.error?.message ?? "Could not send invite.");
        return;
      }
      flash("ok", `Invitation created for ${json.data.email}.`);
      // No email delivery locally — surface the accept link to share manually.
      if (typeof window !== "undefined") {
        setLastLink(`${window.location.origin}${json.data.acceptPath}`);
      }
      setInviteEmail("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="max-w-3xl"><div className="h-40 animate-pulse rounded-xl bg-[var(--border)]" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Members</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{members.length} in {current?.name}</p>
      </header>

      {toast && (
        <div className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: toast.kind === "ok" ? "var(--accent)" : "var(--danger)", color: toast.kind === "ok" ? "var(--accent)" : "var(--danger)", background: "#fff" }}>
          {toast.text}
        </div>
      )}

      {isAdmin && (
        <section className="rounded-xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold">Invite a member</h2>
          <div className="mt-3 flex gap-2">
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="person@example.com"
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
            <button onClick={invite} disabled={busy || !inviteEmail}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? "…" : "Send invite"}
            </button>
          </div>
          {lastLink && (
            <div className="mt-3 rounded-lg border p-3 text-xs" style={{ borderColor: "var(--border)" }}>
              <p className="text-[var(--muted)]">Share this link with the person you invited (email delivery isn't set up yet):</p>
              <code className="mt-1 block break-all">{lastLink}</code>
            </div>
          )}

          {invites.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium">Pending invitations</p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                {invites.map((i) => (
                  <li key={i.id}>{i.email} · {i.role.toLowerCase()}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border bg-[var(--surface)] p-0 overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium text-right">Contributed</th>
              <th className="px-4 py-3 font-medium text-right">Spent</th>
              <th className="px-4 py-3 font-medium text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-3">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-[var(--muted)]">{m.email}</div>
                </td>
                <td className="px-4 py-3">{m.role === "ADMIN" ? "Admin" : "Member"}</td>
                <td className="tabular px-4 py-3 text-right">{m.contributed}</td>
                <td className="tabular px-4 py-3 text-right">{m.spent}</td>
                <td className="tabular px-4 py-3 text-right">{m.net}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
