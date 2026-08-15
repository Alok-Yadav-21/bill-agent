"use client";

import { useRef, useState } from "react";
import { useHousehold } from "@/lib/household-context";

interface Msg { role: "user" | "assistant"; text: string }

const SUGGESTIONS = [
  "How much money is left?",
  "How much have we spent?",
  "Who spent the most?",
];

export default function AssistantPage() {
  const { current } = useHousehold();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!current || !text.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(`/api/ai/query?householdId=${current.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }),
      }).then((r) => r.json());
      const answer = res.ok ? res.data.answer : (res.error?.message ?? "Sorry, something went wrong.");
      setMessages((m) => [...m, { role: "assistant", text: answer }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Network error. Please try again." }]);
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      <header className="mb-4"><h1 className="text-xl font-semibold">AI Assistant</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Answers come from your real budget data.</p></header>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border bg-[var(--surface)] p-4" style={{ borderColor: "var(--border)" }}>
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-sm hover:bg-[var(--accent-weak)]" style={{ borderColor: "var(--border)" }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span className={"inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm " + (m.role === "user" ? "bg-[var(--accent)] text-white" : "bg-[var(--accent-weak)] text-[var(--ink)]")}>
              {m.text}
            </span>
          </div>
        ))}
        {busy && <div className="text-left"><span className="inline-block rounded-2xl bg-[var(--accent-weak)] px-4 py-2 text-sm text-[var(--muted)]">…</span></div>}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask about your budget…" className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
        <button onClick={() => send(input)} disabled={busy || !input.trim()} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Send</button>
      </div>
    </div>
  );
}
