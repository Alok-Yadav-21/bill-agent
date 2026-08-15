import { getSessionUser } from "@/lib/session";
import { ok, fail, guarded } from "@/lib/api-response";
import { prisma } from "@/lib/db";

/** Current user + the households they belong to (for the household switcher). */
export async function GET() {
  return guarded(async () => {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHENTICATED", "You must be signed in.", 401);

    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      include: { household: { select: { id: true, name: true, currency: true } } },
    });

    return ok({
      user,
      households: memberships.map((m) => ({
        id: m.household.id,
        name: m.household.name,
        currency: m.household.currency,
        role: m.role,
      })),
    });
  });
}
