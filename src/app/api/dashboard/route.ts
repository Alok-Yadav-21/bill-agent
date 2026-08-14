import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { requireMembership, ForbiddenError } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { summariseBudget, spendByMember, spendByCategory, evaluateBudgetAlert, type ExpenseLike } from "@/lib/budget";
import { formatMoney } from "@/lib/money";

export async function GET(req: Request) {
  return guarded(async () => {
    const user = await requireUser(req);
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");

    try {
      await requireMembership(user.id, householdId);
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      throw err;
    }

    const [budget, expenses] = await Promise.all([
      prisma.budget.findFirst({ where: { householdId }, orderBy: { startDate: "desc" } }),
      prisma.expense.findMany({
        where: { householdId, status: "CONFIRMED" },
        select: { amountMinor: true, status: true, userId: true, categoryId: true, purchaseDate: true },
      }),
    ]);

    if (!budget) return ok({ configured: false });

    const summary = summariseBudget(budget.amountMinor, expenses as ExpenseLike[]);
    const alert = evaluateBudgetAlert(summary.percentUsed);

    return ok({
      configured: true,
      budget: {
        total: formatMoney(summary.totalBudgetMinor),
        spent: formatMoney(summary.totalSpentMinor),
        remaining: formatMoney(summary.remainingMinor),
        percentUsed: summary.percentUsed,
        transactions: summary.transactionCount,
        averageExpense: formatMoney(summary.averageExpenseMinor),
        overBudget: summary.isOverBudget,
      },
      alert,
      topMembers: spendByMember(expenses as ExpenseLike[]).slice(0, 5),
      topCategories: spendByCategory(expenses as ExpenseLike[]).slice(0, 6),
    });
  });
}
