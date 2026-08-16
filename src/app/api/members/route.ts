import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { requireMembership, ForbiddenError } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { ledgerByMember, type LedgerEntry } from "@/lib/ledger";
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

    const [members, rows] = await Promise.all([
      prisma.householdMember.findMany({
        where: { householdId, status: "ACTIVE" },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      }),
      prisma.transaction.findMany({
        where: { householdId, status: "CONFIRMED" },
        select: { amountMinor: true, isCredit: true, type: true, status: true, userId: true, counterpartyUserId: true, categoryId: true, occurredAt: true },
      }),
    ]);

    const stats = new Map(ledgerByMember(rows as unknown as LedgerEntry[]).map((m) => [m.userId, m]));

    return ok(
      members.map((m) => {
        const s = stats.get(m.user.id);
        return {
          userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role,
          contributed: formatMoney(s?.contributedMinor ?? 0),
          spent: formatMoney(s?.spentMinor ?? 0),
          net: formatMoney(s?.netMinor ?? 0),
          transactions: s?.transactionCount ?? 0,
        };
      }),
    );
  });
}
