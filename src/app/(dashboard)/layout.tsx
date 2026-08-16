import Link from "next/link";
import { HouseholdProvider } from "@/lib/household-context";
import MobileNav from "@/components/mobile-nav";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/scan", label: "Scan Receipt" },
  { href: "/members", label: "Members" },
  { href: "/categories", label: "Categories" },
  { href: "/reports", label: "Reports" },
  { href: "/assistant", label: "AI Assistant" },
  { href: "/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <HouseholdProvider>
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
        <form action="/auth/signout" method="post" className="mt-auto p-3">
          <button type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--muted)] hover:bg-[var(--accent-weak)] hover:text-[var(--ink)]">
            Sign out
          </button>
        </form>
      </aside>

      <main className="px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-8">{children}</main>

      {/* Bottom nav (mobile) with a More sheet exposing every page */}
      <MobileNav />
    </div>
    </HouseholdProvider>
  );
}
