"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signUp() {
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If the project requires email confirmation, there's no session yet.
    if (!data.session) {
      setCheckEmail(true);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div className="rounded-xl border bg-[var(--surface)] p-6 text-sm" style={{ borderColor: "var(--border)" }}>
        <h1 className="text-base font-semibold">Check your email</h1>
        <p className="mt-2 text-[var(--muted)]">
          We sent a confirmation link to <strong>{email}</strong>. Open it to finish setting up your account.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-[var(--surface)] p-6" style={{ borderColor: "var(--border)" }}>
      <h1 className="text-base font-semibold">Create account</h1>
      <Field label="Name" type="text" value={name} onChange={setName} />
      <Field label="Email" type="email" value={email} onChange={setEmail} />
      <Field label="Password" type="password" value={password} onChange={setPassword} />
      {error && <p className="mt-1 text-sm text-[var(--danger)]">{error}</p>}
      <button
        onClick={signUp}
        disabled={busy}
        className="mt-5 w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "Please wait…" : "Create account"}
      </button>
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        Already have an account? <Link href="/login" className="text-[var(--accent)]">Sign in</Link>
      </p>
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
