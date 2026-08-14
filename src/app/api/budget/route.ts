import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { setBudgetSchema } from "@/lib/validation";
import { requireMembership, requireAdmin, ForbiddenError } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { toMinorUnits, formatMoney } from "@/lib/money";

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
    const budget = await prisma.budget.findFirst({ where: { householdId }, orderBy: { startDate: "desc" } });
    return ok(budget ? { ...budget, amountFormatted: formatMoney(budget.amountMinor) } : null);
  });
}

export async function POST(req: Request) {
  return guarded(async () => {
    const user = await requireUser(req);
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
