import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { setBudgetSchema, updateBudgetSchema } from "@/lib/validation";
import { requireMembership, requireAdmin, ForbiddenError } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { toMinorUnits, formatMoney } from "@/lib/money";

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
    const budget = await prisma.budget.findFirst({ where: { householdId }, orderBy: { startDate: "desc" } });
    return ok(budget ? { ...budget, amountFormatted: formatMoney(budget.amountMinor) } : null);
  });
}

export async function POST(req: Request) {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");

    try {
      await requireAdmin(user.id, householdId); // only admins set budgets
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      throw err;
    }

    const body = await req.json().catch(() => null);
    const parsed = setBudgetSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input", 422);

    const budget = await prisma.$transaction(async (tx) => {
      const created = await tx.budget.create({
        data: {
          householdId,
          amountMinor: toMinorUnits(parsed.data.amount),
          periodType: parsed.data.periodType,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        },
      });
      await tx.auditLog.create({
        data: {
          householdId, userId: user.id, action: "budget.create",
          entityType: "Budget", entityId: created.id,
          metadata: { amountMinor: created.amountMinor },
        },
      });
      return created;
    });

    return ok({ ...budget, amountFormatted: formatMoney(budget.amountMinor) }, 201);
  });
}

/**
 * Edits an existing budget in place (e.g. correcting the current period's
 * amount). Admin-only. Records the old and new amounts in the audit log so the
 * change history is preserved even though the row is updated.
 */
export async function PATCH(req: Request) {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");

    try {
      await requireAdmin(user.id, householdId);
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      throw err;
    }

    const body = await req.json().catch(() => null);
    const parsed = updateBudgetSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input", 422);

    // The budget must belong to this household — never trust the id alone.
    const existing = await prisma.budget.findFirst({
      where: { id: parsed.data.budgetId, householdId },
    });
    if (!existing) return fail("NOT_FOUND", "Budget not found", 404);

    const nextAmountMinor =
      parsed.data.amount !== undefined ? toMinorUnits(parsed.data.amount) : existing.amountMinor;

    const budget = await prisma.$transaction(async (tx) => {
      const updated = await tx.budget.update({
        where: { id: existing.id },
        data: {
          amountMinor: nextAmountMinor,
          periodType: parsed.data.periodType ?? existing.periodType,
          startDate: parsed.data.startDate ?? existing.startDate,
          endDate: parsed.data.endDate ?? existing.endDate,
        },
      });
      await tx.auditLog.create({
        data: {
          householdId,
          userId: user.id,
          action: "budget.update",
          entityType: "Budget",
          entityId: updated.id,
          metadata: {
            oldAmountMinor: existing.amountMinor,
            newAmountMinor: updated.amountMinor,
          },
        },
      });
      return updated;
    });

    return ok({ ...budget, amountFormatted: formatMoney(budget.amountMinor) });
  });
}
