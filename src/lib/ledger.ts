/**
 * Ledger engine — the financial source of truth.
 *
 * The household's available balance is ALWAYS derived here from CONFIRMED
 * transactions; it is never stored. This module is pure (no I/O) so the API,
 * UI and AI assistant all get identical numbers, and it is unit-tested.
 *
 * Sign convention (effect on the household's available balance):
 *   CONTRIBUTION  +amount   (money in)
 *   REFUND        +amount   (money in)
 *   EXPENSE       -amount   (money out)
 *   ADJUSTMENT    +/-amount (isCredit ? + : -)
 *   TRANSFER       0        (moves money between members; household net unchanged)
 */

import { sumMinor } from "./money";

export type TransactionType =
  | "CONTRIBUTION"
  | "EXPENSE"
  | "TRANSFER"
  | "REFUND"
  | "ADJUSTMENT";
export type TransactionStatus = "CONFIRMED" | "PENDING" | "VOID";

export interface LedgerEntry {
  amountMinor: number; // always positive
  isCredit: boolean; // only used for ADJUSTMENT
  type: TransactionType;
  status: TransactionStatus;
  userId: string;
  counterpartyUserId: string | null;
  categoryId: string | null;
  occurredAt: Date;
}

export function countsTowardBalance(t: LedgerEntry): boolean {
  return t.status === "CONFIRMED";
}

/** Signed effect of a transaction on the household's available balance. */
export function householdEffectMinor(t: LedgerEntry): number {
  switch (t.type) {
    case "CONTRIBUTION":
    case "REFUND":
      return t.amountMinor;
    case "EXPENSE":
      return -t.amountMinor;
    case "ADJUSTMENT":
      return t.isCredit ? t.amountMinor : -t.amountMinor;
    case "TRANSFER":
      return 0; // stays within the household
  }
}

export interface LedgerSummary {
  availableBalanceMinor: number; // money in - money out
  totalContributionsMinor: number; // CONTRIBUTION + REFUND
  totalExpensesMinor: number; // EXPENSE
  totalAdjustmentsMinor: number; // signed
  transactionCount: number; // confirmed, all types
  expenseCount: number;
}

export function summariseLedger(entries: LedgerEntry[]): LedgerSummary {
  const confirmed = entries.filter(countsTowardBalance);

  const contributions = confirmed.filter((t) => t.type === "CONTRIBUTION" || t.type === "REFUND");
  const expenses = confirmed.filter((t) => t.type === "EXPENSE");
  const adjustments = confirmed.filter((t) => t.type === "ADJUSTMENT");

  const totalContributionsMinor = sumMinor(contributions.map((t) => t.amountMinor));
  const totalExpensesMinor = sumMinor(expenses.map((t) => t.amountMinor));
  const totalAdjustmentsMinor = sumMinor(adjustments.map(householdEffectMinor));

  const availableBalanceMinor = sumMinor(confirmed.map(householdEffectMinor));

  return {
    availableBalanceMinor,
    totalContributionsMinor,
    totalExpensesMinor,
    totalAdjustmentsMinor,
    transactionCount: confirmed.length,
    expenseCount: expenses.length,
  };
}

export interface MemberLedger {
  userId: string;
  contributedMinor: number; // money this member put in (CONTRIBUTION + REFUND + transfers received)
  spentMinor: number; // money this member took out (EXPENSE + transfers sent)
  netMinor: number; // contributed - spent (their standing in the household)
  transactionCount: number;
}

/**
 * Per-member standing. Transfers are attributed: the sender's `spent` rises,
 * the receiver's `contributed` rises, so household totals stay balanced.
 */
export function ledgerByMember(entries: LedgerEntry[]): MemberLedger[] {
  const confirmed = entries.filter(countsTowardBalance);
  const acc = new Map<string, { c: number; s: number; n: number }>();
  const bump = (uid: string, contributed = 0, spent = 0) => {
    const cur = acc.get(uid) ?? { c: 0, s: 0, n: 0 };
    cur.c += contributed;
    cur.s += spent;
    cur.n += 1;
    acc.set(uid, cur);
  };

  for (const t of confirmed) {
    switch (t.type) {
      case "CONTRIBUTION":
      case "REFUND":
        bump(t.userId, t.amountMinor, 0);
        break;
      case "EXPENSE":
        bump(t.userId, 0, t.amountMinor);
        break;
      case "ADJUSTMENT":
        if (t.isCredit) bump(t.userId, t.amountMinor, 0);
        else bump(t.userId, 0, t.amountMinor);
        break;
      case "TRANSFER":
        bump(t.userId, 0, t.amountMinor); // sender pays
        if (t.counterpartyUserId) bump(t.counterpartyUserId, t.amountMinor, 0); // receiver gains
        break;
    }
  }

  return [...acc.entries()]
    .map(([userId, v]) => ({
      userId,
      contributedMinor: v.c,
      spentMinor: v.s,
      netMinor: v.c - v.s,
      transactionCount: v.n,
    }))
    .sort((a, b) => b.spentMinor - a.spentMinor);
}

export interface CategoryLedger {
  categoryId: string | null;
  spentMinor: number;
  transactionCount: number;
}

/** Category breakdown of EXPENSE transactions only. */
export function ledgerByCategory(entries: LedgerEntry[]): CategoryLedger[] {
  const expenses = entries.filter((t) => countsTowardBalance(t) && t.type === "EXPENSE");
  const acc = new Map<string | null, { total: number; n: number }>();
  for (const t of expenses) {
    const cur = acc.get(t.categoryId) ?? { total: 0, n: 0 };
    cur.total += t.amountMinor;
    cur.n += 1;
    acc.set(t.categoryId, cur);
  }
  return [...acc.entries()]
    .map(([categoryId, v]) => ({ categoryId, spentMinor: v.total, transactionCount: v.n }))
    .sort((a, b) => b.spentMinor - a.spentMinor);
}

/** "Can the household afford £X right now?" — based on available balance. */
export function canAffordFromBalance(
  availableBalanceMinor: number,
  amountMinor: number,
): { affordable: boolean; shortfallMinor: number } {
  const after = availableBalanceMinor - amountMinor;
  return { affordable: after >= 0, shortfallMinor: after < 0 ? -after : 0 };
}
