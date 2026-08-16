"use client";

import Link from "next/link";
import { useState } from "react";

const PRIMARY = [
  { href: "/dashboard", label: "Home" },
  { href: "/expenses", label: "Expenses" },
  { href: "/scan", label: "Scan", accent: true },
];

const ALL = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/expenses", label: "Expenses" },
  { href: "/scan", label: "Scan Receipt" },
  { href: "/members", label: "Members" },
  { href: "/categories", label: "Categories" },
  { href: "/reports", label: "Reports" },
  { href: "/assistant", label: "AI Assistant" },
  { href: "/settings", label: "Settings" },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Bottom bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t bg-[var(--surface)] flex justify-around py-2"
        style={{ borderColor: "var(--border)" }}
      >
        {PRIMARY.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={"text-xs px-3 py-1 " + (n.accent ? "font-semibold text-[var(--accent)]" : "")}
          >
            {n.label}
          </Link>
        ))}
        <button onClick={() => setOpen(true)} className="text-xs px-3 py-1">
          More
        </button>
      </nav>

      {/* Slide-up sheet */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-[var(--surface)] p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)]" />
            <div className="grid grid-cols-2 gap-2">
              {ALL.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg border px-3 py-3 text-sm hover:bg-[var(--accent-weak)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  {n.label}
                </Link>
              ))}
            </div>
            <form action="/auth/signout" method="post" className="mt-3">
              <button
                type="submit"
                className="w-full rounded-lg border px-3 py-3 text-sm text-[var(--danger)]"
                style={{ borderColor: "var(--border)" }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
