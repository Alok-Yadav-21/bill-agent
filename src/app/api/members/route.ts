import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { requireMembership, ForbiddenError } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { spendByMember, type ExpenseLike } from "@/lib/budget";
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

    const [members, expenses] = await Promise.all([
      prisma.householdMember.findMany({
        where: { householdId, status: "ACTIVE" },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { joinedAt: "asc" },
      }),
      prisma.expense.findMany({
        where: { householdId, status: "CONFIRMED" },
        select: { amountMinor: true, status: true, userId: true, categoryId: true, purchaseDate: true },
      }),
    ]);

    const spend = new Map(spendByMember(expenses as ExpenseLike[]).map((s) => [s.userId, s]));

    return ok(
      members.map((m) => {
        const s = spend.get(m.user.id);
        return {
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          spent: formatMoney(s?.totalMinor ?? 0),
          transactions: s?.transactionCount ?? 0,
          percentOfHousehold: s?.percentOfHousehold ?? 0,
        };
      }),
    );
  });
}
