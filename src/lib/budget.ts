/**
 * Budget calculation engine.
 *
 * This is the single source of truth for financial math. It is a PURE module:
 * it takes already-fetched data (budget + expenses) and computes derived
 * figures. It never stores a "remaining_budget" field — remaining is ALWAYS
 * derived: remaining = total_budget - total_valid_expenses.
 *
 * The database aggregates the raw numbers (see repositories); this module turns
 * them into the figures the UI, API and AI assistant all consume. Because it is
 * pure, the AI assistant and n8n cannot produce a *different* answer — they must
 * call the backend, which runs this same code.
 */

import { sumMinor } from "./money";

export type ExpenseStatus = "CONFIRMED" | "PENDING" | "CANCELLED";

export interface ExpenseLike {
  amountMinor: number;
  status: ExpenseStatus;
  userId: string;
  categoryId: string | null;
  purchaseDate: Date;
}

export interface BudgetSummary {
  totalBudgetMinor: number;
  totalSpentMinor: number;
  remainingMinor: number;
  /** Percentage of budget used, 0–100+ (can exceed 100 when overspent). */
  percentUsed: number;
  transactionCount: number;
  averageExpenseMinor: number;
  isOverBudget: boolean;
}

/**
 * Only CONFIRMED expenses count against the budget. PENDING receipts awaiting
 * user confirmation and CANCELLED entries are excluded from the authoritative
 * spend. This rule lives in exactly one place.
 */
export function countsTowardSpend(e: ExpenseLike): boolean {
  return e.status === "CONFIRMED";
}

export function summariseBudget(
  totalBudgetMinor: number,
  expenses: ExpenseLike[],
): BudgetSummary {
  if (!Number.isInteger(totalBudgetMinor) || totalBudgetMinor < 0) {
    throw new Error("Budget must be a non-negative integer minor-unit value");
  }

  const valid = expenses.filter(countsTowardSpend);
  const totalSpentMinor = sumMinor(valid.map((e) => e.amountMinor));
  const remainingMinor = totalBudgetMinor - totalSpentMinor;
  const transactionCount = valid.length;
  const averageExpenseMinor =
    transactionCount === 0 ? 0 : Math.round(totalSpentMinor / transactionCount);
  const percentUsed =
    totalBudgetMinor === 0
      ? totalSpentMinor > 0
        ? Infinity
        : 0
      : (totalSpentMinor / totalBudgetMinor) * 100;

  return {
    totalBudgetMinor,
    totalSpentMinor,
    remainingMinor,
    percentUsed: Number(percentUsed.toFixed(2)),
    transactionCount,
    averageExpenseMinor,
    isOverBudget: remainingMinor < 0,
  };
}

/** Budget alert thresholds, evaluated automatically from percentUsed. */
export const BUDGET_THRESHOLDS = [70, 80, 90, 100] as const;
export type BudgetThreshold = (typeof BUDGET_THRESHOLDS)[number];

export interface BudgetAlert {
  threshold: BudgetThreshold;
  message: string;
}

/**
 * Returns the single highest threshold crossed (if any). Used by both the live
 * dashboard and the n8n scheduled monitor — same logic, one place.
 */
export function evaluateBudgetAlert(percentUsed: number): BudgetAlert | null {
  const crossed = [...BUDGET_THRESHOLDS]
    .reverse()
    .find((t) => percentUsed >= t);
  if (crossed === undefined) return null;

  const messages: Record<BudgetThreshold, string> = {
    70: "⚠️ You have used 70% of your household budget.",
    80: "⚠️ Household budget is 80% used.",
    90: "🚨 Only 10% of the household budget remains.",
    100: "🚨 Household budget has been exceeded.",
  };
  return { threshold: crossed, message: messages[crossed] };
}

/** "Can we afford £X more?" — used by the AI assistant affordability tool. */
export function canAfford(
  summary: Pick<BudgetSummary, "remainingMinor">,
  amountMinor: number,
): { affordable: boolean; shortfallMinor: number } {
  const after = summary.remainingMinor - amountMinor;
  return { affordable: after >= 0, shortfallMinor: after < 0 ? -after : 0 };
}

export interface MemberSpend {
  userId: string;
  totalMinor: number;
  transactionCount: number;
  averageMinor: number;
  percentOfHousehold: number;
}

export function spendByMember(expenses: ExpenseLike[]): MemberSpend[] {
  const valid = expenses.filter(countsTowardSpend);
  const total = sumMinor(valid.map((e) => e.amountMinor));
  const byUser = new Map<string, number[]>();
  for (const e of valid) {
    const arr = byUser.get(e.userId) ?? [];
    arr.push(e.amountMinor);
    byUser.set(e.userId, arr);
  }
  return [...byUser.entries()]
    .map(([userId, amounts]) => {
      const t = sumMinor(amounts);
      return {
        userId,
        totalMinor: t,
        transactionCount: amounts.length,
        averageMinor: Math.round(t / amounts.length),
        percentOfHousehold: total === 0 ? 0 : Number(((t / total) * 100).toFixed(2)),
      };
    })
    .sort((a, b) => b.totalMinor - a.totalMinor);
}

export interface CategorySpend {
  categoryId: string | null;
  totalMinor: number;
  transactionCount: number;
}

export function spendByCategory(expenses: ExpenseLike[]): CategorySpend[] {
  const valid = expenses.filter(countsTowardSpend);
  const byCat = new Map<string | null, number[]>();
  for (const e of valid) {
    const arr = byCat.get(e.categoryId) ?? [];
    arr.push(e.amountMinor);
    byCat.set(e.categoryId, arr);
  }
  return [...byCat.entries()]
    .map(([categoryId, amounts]) => ({
      categoryId,
      totalMinor: sumMinor(amounts),
      transactionCount: amounts.length,
    }))
    .sort((a, b) => b.totalMinor - a.totalMinor);
}
