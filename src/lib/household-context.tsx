"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface HouseholdSummary {
  id: string;
  name: string;
  currency: string;
  role: "ADMIN" | "MEMBER";
}

interface HouseholdContextValue {
  current: HouseholdSummary | null;
  households: HouseholdSummary[];
  setCurrent: (id: string) => void;
  loading: boolean;
}

const Ctx = createContext<HouseholdContextValue | null>(null);
const STORAGE_KEY = "currentHouseholdId";

/**
 * Loads the signed-in user's households from /api/me and exposes the "current"
 * one to the app. Replaces the old hardcoded NEXT_PUBLIC_DEMO_HOUSEHOLD_ID.
 * If the user belongs to no household, redirects to /onboarding.
 */
export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [current, setCurrentState] = useState<HouseholdSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        if (!json.ok) {
          router.replace("/login");
          return;
        }
        const hs: HouseholdSummary[] = json.data.households ?? [];
        if (hs.length === 0) {
          router.replace("/onboarding");
          return;
        }
        setHouseholds(hs);
        const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        setCurrentState(hs.find((h) => h.id === stored) ?? hs[0]);
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [router]);

  function setCurrent(id: string) {
    const h = households.find((x) => x.id === id);
    if (!h) return;
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
    setCurrentState(h);
  }

  return <Ctx.Provider value={{ current, households, setCurrent, loading }}>{children}</Ctx.Provider>;
}

export function useHousehold(): HouseholdContextValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useHousehold must be used within HouseholdProvider");
  return c;
}
