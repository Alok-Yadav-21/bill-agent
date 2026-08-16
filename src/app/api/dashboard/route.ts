import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { requireMembership, ForbiddenError } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { summariseLedger, ledgerByMember, ledgerByCategory, type LedgerEntry } from "@/lib/ledger";
import { evaluateBudgetAlert } from "@/lib/budget";
import { formatMoney } from "@/lib/money";

export async function GET(req: Request) {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");
    try {
      await requireMembership(user.id, householdId);
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      throw err;
    }

    const [budget, rows] = await Promise.all([
      prisma.budget.findFirst({ where: { householdId }, orderBy: { startDate: "desc" } }),
      prisma.transaction.findMany({
        where: { householdId, status: "CONFIRMED" },
        select: {
          amountMinor: true, isCredit: true, type: true, status: true,
          userId: true, counterpartyUserId: true, categoryId: true, occurredAt: true,
        },
      }),
    ]);

    const ledger = summariseLedger(rows as unknown as LedgerEntry[]);

    // Budget is an optional monthly target; usage is measured against expenses.
    let budgetBlock = null;
    let alert = null;
    if (budget && budget.amountMinor > 0) {
      const percentUsed = Number(((ledger.totalExpensesMinor / budget.amountMinor) * 100).toFixed(2));
      alert = evaluateBudgetAlert(percentUsed);
      budgetBlock = {
        total: formatMoney(budget.amountMinor),
        spent: formatMoney(ledger.totalExpensesMinor),
        percentUsed,
        overBudget: ledger.totalExpensesMinor > budget.amountMinor,
      };
    }

    return ok({
      configured: true,
      balance: {
        available: formatMoney(ledger.availableBalanceMinor),
        availableMinor: ledger.availableBalanceMinor,
        contributions: formatMoney(ledger.totalContributionsMinor),
        expenses: formatMoney(ledger.totalExpensesMinor),
        transactions: ledger.transactionCount,
        negative: ledger.availableBalanceMinor < 0,
      },
      budget: budgetBlock,
      alert,
      topMembers: ledgerByMember(rows as unknown as LedgerEntry[]).slice(0, 5),
      topCategories: ledgerByCategory(rows as unknown as LedgerEntry[]).slice(0, 6),
    });
  });
}
