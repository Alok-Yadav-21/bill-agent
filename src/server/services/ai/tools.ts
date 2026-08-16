/**
 * AI assistant tools — the ONLY way the assistant reads financial data.
 * Each runs a real authorized query and reuses the same ledger engine the
 * dashboard uses, so the AI's answer to "how much is left?" is byte-for-byte
 * the dashboard's available balance. The model never computes money itself.
 */

import { prisma } from "@/lib/db";
import {
  summariseLedger, ledgerByMember, ledgerByCategory, canAffordFromBalance,
  type LedgerEntry,
} from "@/lib/ledger";
import { formatMoney } from "@/lib/money";

const SELECT = {
  amountMinor: true, isCredit: true, type: true, status: true,
  userId: true, counterpartyUserId: true, categoryId: true, occurredAt: true,
} as const;

async function loadLedger(householdId: string) {
  const rows = await prisma.transaction.findMany({
    where: { householdId, status: "CONFIRMED" }, select: SELECT,
  });
  return rows as unknown as LedgerEntry[];
}

export interface ToolContext {
  householdId: string;
  userId: string;
}

export const aiTools = {
  async get_balance(ctx: ToolContext) {
    const s = summariseLedger(await loadLedger(ctx.householdId));
    return {
      availableBalance: formatMoney(s.availableBalanceMinor),
      totalContributed: formatMoney(s.totalContributionsMinor),
      totalSpent: formatMoney(s.totalExpensesMinor),
      transactions: s.transactionCount,
    };
  },

  async get_remaining_budget(ctx: ToolContext) {
    const s = summariseLedger(await loadLedger(ctx.householdId));
    return { availableBalance: formatMoney(s.availableBalanceMinor), availableMinor: s.availableBalanceMinor };
  },

  async get_member_spending(ctx: ToolContext) {
    const ranked = ledgerByMember(await loadLedger(ctx.householdId));
    const users = await prisma.user.findMany({
      where: { id: { in: ranked.map((m) => m.userId) } }, select: { id: true, name: true },
    });
    const nameOf = new Map(users.map((u) => [u.id, u.name]));
    return ranked.map((m) => ({
      member: nameOf.get(m.userId) ?? m.userId,
      contributed: formatMoney(m.contributedMinor),
      spent: formatMoney(m.spentMinor),
      net: formatMoney(m.netMinor),
    }));
  },

  async get_category_spending(ctx: ToolContext) {
    const byCat = ledgerByCategory(await loadLedger(ctx.householdId));
    const cats = await prisma.expenseCategory.findMany({
      where: { id: { in: byCat.map((c) => c.categoryId).filter(Boolean) as string[] } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(cats.map((c) => [c.id, c.name]));
    return byCat.map((c) => ({
      category: c.categoryId ? nameOf.get(c.categoryId) ?? "Unknown" : "Uncategorised",
      spent: formatMoney(c.spentMinor), transactions: c.transactionCount,
    }));
  },

  async can_afford(ctx: ToolContext, args: { amountMinor: number }) {
    const s = summariseLedger(await loadLedger(ctx.householdId));
    const r = canAffordFromBalance(s.availableBalanceMinor, args.amountMinor);
    return {
      affordable: r.affordable,
      availableBalance: formatMoney(s.availableBalanceMinor),
      shortfall: r.affordable ? null : formatMoney(r.shortfallMinor),
    };
  },
} as const;

export type AiToolName = keyof typeof aiTools;
