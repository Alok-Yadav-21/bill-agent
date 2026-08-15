import { requireUser } from "@/lib/session";
import { ok, fail, guarded } from "@/lib/api-response";
import { createHouseholdSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { toMinorUnits } from "@/lib/money";

export async function POST(req: Request) {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;

    const body = await req.json().catch(() => null);
    const parsed = createHouseholdSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input", 422);

    const household = await prisma.$transaction(async (tx) => {
      const h = await tx.household.create({
        data: { name: parsed.data.name, currency: parsed.data.currency, createdBy: user.id },
      });
      // Creator becomes ADMIN.
      await tx.householdMember.create({
        data: { householdId: h.id, userId: user.id, role: "ADMIN", status: "ACTIVE" },
      });
      if (parsed.data.budget) {
        await tx.budget.create({
          data: {
            householdId: h.id,
            amountMinor: toMinorUnits(parsed.data.budget.amount),
            currency: parsed.data.currency,
            periodType: parsed.data.budget.periodType,
            startDate: parsed.data.budget.startDate,
            endDate: parsed.data.budget.endDate,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          householdId: h.id, userId: user.id, action: "household.create",
          entityType: "Household", entityId: h.id, metadata: { name: h.name },
        },
      });
      return h;
    });

    return ok({ id: household.id, name: household.name, currency: household.currency }, 201);
  });
}

// List the current user's households (same data as /api/me but scoped here).
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      include: { household: { select: { id: true, name: true, currency: true } } },
    });
    return ok(
      memberships.map((m) => ({
        id: m.household.id, name: m.household.name, currency: m.household.currency, role: m.role,
      })),
    );
  });
}
