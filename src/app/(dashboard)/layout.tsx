import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/expenses", label: "Expenses" },
  { href: "/scan", label: "Scan Receipt" },
  { href: "/members", label: "Members" },
  { href: "/categories", label: "Categories" },
  { href: "/reports", label: "Reports" },
  { href: "/assistant", label: "AI Assistant" },
  { href: "/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col border-r bg-[var(--surface)]" style={{ borderColor: "var(--border)" }}>
        <div className="px-5 py-5 text-lg font-semibold">Bill Agent</div>
        <nav className="px-3 space-y-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className="block rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--accent-weak)] hover:text-[var(--ink)]">
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-8">{children}</main>

      {/* Bottom nav (mobile) — Scan Receipt is prominent per spec */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden border-t bg-[var(--surface)] flex justify-around py-2"
        style={{ borderColor: "var(--border)" }}>
        <Link href="/dashboard" className="text-xs px-3 py-1">Home</Link>
        <Link href="/expenses" className="text-xs px-3 py-1">Expenses</Link>
        <Link href="/scan" className="text-xs px-3 py-1 font-semibold text-[var(--accent)]">Scan</Link>
        <Link href="/assistant" className="text-xs px-3 py-1">Ask AI</Link>
      </nav>
    </div>
  );
}
