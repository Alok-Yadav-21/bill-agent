import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { resetHouseholdSchema } from "@/lib/validation";
import { requireCapability, ForbiddenError } from "@/lib/authz";
import { prisma } from "@/lib/db";

/**
 * Resets a household's financial records. ADMIN-only (household.manage), scoped
 * strictly to this household — never touches other households or the wider
 * database. Requires typing the household name to confirm. Keeps members and the
 * household itself; wipes transactions, expenses, budgets, receipts,
 * notifications and custom categories. Writes an audit entry.
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");

    try {
      await requireCapability(user.id, householdId, "household.manage"); // ADMIN only
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", "Only an admin can reset the household.", 403);
      throw err;
    }

    const body = await req.json().catch(() => null);
    const parsed = resetHouseholdSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", "Confirmation is required.", 422);

    const household = await prisma.household.findUnique({ where: { id: householdId } });
    if (!household) return fail("NOT_FOUND", "Household not found", 404);
    if (parsed.data.confirm.trim() !== household.name) {
      return fail("CONFIRM_MISMATCH", "The name you typed doesn't match. Nothing was reset.", 422);
    }

    const result = await prisma.$transaction(async (tx) => {
      const [txns, expenses, receipts, budgets, notifs, cats] = await Promise.all([
        tx.transaction.deleteMany({ where: { householdId } }),
        tx.expense.deleteMany({ where: { householdId } }),
        tx.receipt.deleteMany({ where: { householdId } }),
        tx.budget.deleteMany({ where: { householdId } }),
        tx.notification.deleteMany({ where: { householdId } }),
        tx.expenseCategory.deleteMany({ where: { householdId } }), // custom only (global have null householdId)
      ]);
      await tx.auditLog.create({
        data: {
          householdId, userId: user.id, action: "household.reset",
          entityType: "Household", entityId: householdId,
          metadata: {
            transactions: txns.count, expenses: expenses.count, receipts: receipts.count,
            budgets: budgets.count, notifications: notifs.count, categories: cats.count,
          },
        },
      });
      return { transactions: txns.count, expenses: expenses.count };
    });

    return ok({ reset: true, ...result });
  });
}
