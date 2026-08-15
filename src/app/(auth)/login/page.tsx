"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError("That email and password don't match an account.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <Card>
      <h1 className="text-base font-semibold">Sign in</h1>
      <Field label="Email" type="email" value={email} onChange={setEmail} />
      <Field label="Password" type="password" value={password} onChange={setPassword} />
      {error && <p className="mt-1 text-sm text-[var(--danger)]">{error}</p>}
      <Button onClick={signIn} busy={busy}>Sign in</Button>
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        No account? <Link href="/register" className="text-[var(--accent)]">Create one</Link>
      </p>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-[var(--surface)] p-6" style={{ borderColor: "var(--border)" }}>
      {children}
    </div>
  );
}
function Field({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        style={{ borderColor: "var(--border)" }}
      />
    </label>
  );
}
function Button({ children, onClick, busy }: { children: React.ReactNode; onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="mt-5 w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {busy ? "Please wait…" : children}
    </button>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
