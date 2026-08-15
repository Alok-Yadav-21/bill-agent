import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { requireMembership, ForbiddenError } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(1).max(60),
  icon: z.string().max(40).optional(),
});

// List categories available to a household: its own + global (householdId null).
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
    const categories = await prisma.expenseCategory.findMany({
      where: { OR: [{ householdId }, { householdId: null }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, icon: true, householdId: true },
    });
    return ok(
      categories.map((c) => ({ ...c, custom: c.householdId !== null })),
    );
  });
}

// Any active member can add a custom category for the household.
export async function POST(req: Request) {
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
    const body = await req.json().catch(() => null);
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input", 422);

    // Prevent duplicates within the household.
    const existing = await prisma.expenseCategory.findFirst({
      where: { householdId, name: parsed.data.name },
    });
    if (existing) return fail("DUPLICATE", "A category with that name already exists.", 409);

    const category = await prisma.expenseCategory.create({
      data: { householdId, name: parsed.data.name, icon: parsed.data.icon },
    });
    return ok({ ...category, custom: true }, 201);
  });
}
