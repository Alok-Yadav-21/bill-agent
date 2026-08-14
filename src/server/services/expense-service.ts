import { prisma } from "@/lib/db";
import { toMinorUnits } from "@/lib/money";
import { summariseBudget, evaluateBudgetAlert, type ExpenseLike } from "@/lib/budget";
import { requireMembership, requireAdmin } from "@/lib/authz";
import { Prisma } from "@prisma/client";

interface CreateExpenseArgs {
  householdId: string;
  actorUserId: string;
  amountMajor: number;
  merchant?: string;
  description?: string;
  categoryId?: string | null;
  purchaseDate?: Date;
  source?: "MANUAL" | "RECEIPT" | "AI";
  status?: "CONFIRMED" | "PENDING";
  receiptId?: string;
}

/**
 * Creates an expense inside a serializable transaction so that concurrent
 * submissions cannot corrupt derived totals. Remaining budget is never stored;
 * it is recomputed from the committed rows. Also writes an audit log entry and,
 * if a budget threshold is newly crossed, a household notification.
 */
export async function createExpense(args: CreateExpenseArgs) {
  await requireMembership(args.actorUserId, args.householdId);
  const amountMinor = toMinorUnits(args.amountMajor);
  if (amountMinor <= 0) throw new Error("Amount must be greater than 0");

  return prisma.$transaction(
    async (tx) => {
      const expense = await tx.expense.create({
        data: {
          householdId: args.householdId,
          userId: args.actorUserId,
          categoryId: args.categoryId ?? null,
          amountMinor,
          merchant: args.merchant,
          description: args.description,
          purchaseDate: args.purchaseDate ?? new Date(),
          source: args.source ?? "MANUAL",
          status: args.status ?? "CONFIRMED",
          receiptId: args.receiptId,
        },
      });

      await tx.auditLog.create({
        data: {
          householdId: args.householdId,
          userId: args.actorUserId,
          action: "expense.create",
          entityType: "Expense",
          entityId: expense.id,
          metadata: { amountMinor, merchant: args.merchant ?? null },
        },
      });

      // Recompute authoritative figures from committed rows.
      const [budget, expenses] = await Promise.all([
        tx.budget.findFirst({ where: { householdId: args.householdId }, orderBy: { startDate: "desc" } }),
        tx.expense.findMany({
          where: { householdId: args.householdId, status: "CONFIRMED" },
          select: { amountMinor: true, status: true, userId: true, categoryId: true, purchaseDate: true },
        }),
      ]);

      let summary = null;
      if (budget) {
        summary = summariseBudget(budget.amountMinor, expenses as ExpenseLike[]);
        const alert = evaluateBudgetAlert(summary.percentUsed);
        if (alert) {
          await tx.notification.create({
            data: {
              householdId: args.householdId,
              userId: null, // household-wide
              type: `budget.threshold.${alert.threshold}`,
              title: "Budget alert",
              message: alert.message,
            },
          });
        }
      }

      return { expense, summary };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/** Only the author or an admin may delete; deletion is audited. */
export async function deleteExpense(args: {
  householdId: string;
  actorUserId: string;
  expenseId: string;
}) {
  const expense = await prisma.expense.findFirst({
    where: { id: args.expenseId, householdId: args.householdId },
  });
  if (!expense) throw new Error("Expense not found");

  const membership = await requireMembership(args.actorUserId, args.householdId);
  const isAuthor = expense.userId === args.actorUserId;
  if (!isAuthor && membership.role !== "ADMIN") {
    await requireAdmin(args.actorUserId, args.householdId); // throws Forbidden
  }

  return prisma.$transaction(async (tx) => {
    await tx.expense.delete({ where: { id: args.expenseId } });
    await tx.auditLog.create({
      data: {
        householdId: args.householdId,
        userId: args.actorUserId,
        action: "expense.delete",
        entityType: "Expense",
        entityId: args.expenseId,
        metadata: { amountMinor: expense.amountMinor },
      },
    });
  });
}
