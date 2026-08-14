/**
 * AI assistant tools.
 *
 * These are the ONLY way the assistant obtains or changes financial data. Each
 * tool runs a real, authorized backend query and reuses the same budget.ts
 * engine the dashboard uses — so the AI's answer to "how much is left?" is
 * byte-for-byte the dashboard's answer. The model never computes money itself.
 *
 * Every tool is scoped to a householdId that the CALLER has already authorized.
 * AI permissions are not security; the caller (API route) enforces access.
 */

import { prisma } from "@/lib/db";
import {
  summariseBudget,
  spendByMember,
  spendByCategory,
  canAfford,
  type ExpenseLike,
} from "@/lib/budget";
import { formatMoney } from "@/lib/money";

async function loadContext(householdId: string) {
  const [budget, expenses] = await Promise.all([
    prisma.budget.findFirst({
      where: { householdId },
      orderBy: { startDate: "desc" },
    }),
    prisma.expense.findMany({
      where: { householdId, status: "CONFIRMED" },
      select: {
        amountMinor: true,
        status: true,
        userId: true,
        categoryId: true,
        purchaseDate: true,
      },
    }),
  ]);
  return { budget, expenses: expenses as ExpenseLike[] };
}

export interface ToolContext {
  householdId: string;
  /** The authenticated user issuing the query (for "how much did I spend"). */
  userId: string;
}

export const aiTools = {
  async get_budget_status(ctx: ToolContext) {
    const { budget, expenses } = await loadContext(ctx.householdId);
    if (!budget) return { error: "No budget configured for this household." };
    const s = summariseBudget(budget.amountMinor, expenses);
    return {
      totalBudget: formatMoney(s.totalBudgetMinor),
      totalSpent: formatMoney(s.totalSpentMinor),
      remaining: formatMoney(s.remainingMinor),
      percentUsed: s.percentUsed,
      transactions: s.transactionCount,
    };
  },

  async get_remaining_budget(ctx: ToolContext) {
    const { budget, expenses } = await loadContext(ctx.householdId);
    if (!budget) return { error: "No budget configured." };
    const s = summariseBudget(budget.amountMinor, expenses);
    return { remaining: formatMoney(s.remainingMinor), remainingMinor: s.remainingMinor };
  },

  async get_member_spending(ctx: ToolContext) {
    const { expenses } = await loadContext(ctx.householdId);
    const ranked = spendByMember(expenses);
    const users = await prisma.user.findMany({
      where: { id: { in: ranked.map((m) => m.userId) } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(users.map((u) => [u.id, u.name]));
    return ranked.map((m) => ({
      member: nameOf.get(m.userId) ?? m.userId,
      spent: formatMoney(m.totalMinor),
      transactions: m.transactionCount,
      percentOfHousehold: m.percentOfHousehold,
    }));
  },

  async get_category_spending(ctx: ToolContext) {
    const { expenses } = await loadContext(ctx.householdId);
    const byCat = spendByCategory(expenses);
    const cats = await prisma.expenseCategory.findMany({
      where: { id: { in: byCat.map((c) => c.categoryId).filter(Boolean) as string[] } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(cats.map((c) => [c.id, c.name]));
    return byCat.map((c) => ({
      category: c.categoryId ? nameOf.get(c.categoryId) ?? "Unknown" : "Uncategorised",
      spent: formatMoney(c.totalMinor),
      transactions: c.transactionCount,
    }));
  },

  async can_afford(ctx: ToolContext, args: { amountMinor: number }) {
    const { budget, expenses } = await loadContext(ctx.householdId);
    if (!budget) return { error: "No budget configured." };
    const s = summariseBudget(budget.amountMinor, expenses);
    const result = canAfford(s, args.amountMinor);
    return {
      affordable: result.affordable,
      remaining: formatMoney(s.remainingMinor),
      shortfall: result.affordable ? null : formatMoney(result.shortfallMinor),
    };
  },

  async search_expenses(
    ctx: ToolContext,
    args: { merchant?: string; userId?: string; limit?: number },
  ) {
    const rows = await prisma.expense.findMany({
      where: {
        householdId: ctx.householdId,
        status: "CONFIRMED",
        ...(args.merchant
          ? { merchant: { contains: args.merchant, mode: "insensitive" } }
          : {}),
        ...(args.userId ? { userId: args.userId } : {}),
      },
      orderBy: { purchaseDate: "desc" },
      take: Math.min(args.limit ?? 20, 100),
      select: { merchant: true, amountMinor: true, purchaseDate: true, description: true },
    });
    return rows.map((r) => ({
      merchant: r.merchant,
      amount: formatMoney(r.amountMinor),
      date: r.purchaseDate.toISOString().slice(0, 10),
      description: r.description,
    }));
  },
} as const;

export type AiToolName = keyof typeof aiTools;
