import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { createExpenseSchema } from "@/lib/validation";
import { createExpense } from "@/server/services/expense-service";
import { requireMembership, ForbiddenError } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export async function POST(req: Request) {
  return guarded(async () => {
    const user = await requireUser(req);
    if (user instanceof Response) return user;

    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");

    const body = await req.json().catch(() => null);
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input", 422);
    }

    try {
      const { expense, summary } = await createExpense({
        householdId,
        actorUserId: user.id,
        amountMajor: parsed.data.amount,
        merchant: parsed.data.merchant,
        description: parsed.data.description,
        categoryId: parsed.data.categoryId ?? null,
        purchaseDate: parsed.data.purchaseDate,
      });
      return ok(
        {
          expense,
          remaining: summary ? formatMoney(summary.remainingMinor) : null,
        },
        201,
      );
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      throw err;
    }
  });
}

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

    const url = new URL(req.url);
    const take = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const skip = Number(url.searchParams.get("offset") ?? 0);
    const merchant = url.searchParams.get("merchant") ?? undefined;
    const memberId = url.searchParams.get("memberId") ?? undefined;
    const categoryId = url.searchParams.get("categoryId") ?? undefined;

    const [rows, total] = await Promise.all([
      prisma.expense.findMany({
        where: {
          householdId,
          ...(merchant ? { merchant: { contains: merchant, mode: "insensitive" } } : {}),
          ...(memberId ? { userId: memberId } : {}),
          ...(categoryId ? { categoryId } : {}),
        },
        orderBy: { purchaseDate: "desc" },
        take,
        skip,
        include: { user: { select: { name: true } }, category: { select: { name: true } } },
      }),
      prisma.expense.count({ where: { householdId } }),
    ]);

    return ok({
      expenses: rows.map((r) => ({
        id: r.id,
        date: r.purchaseDate,
        member: r.user.name,
        merchant: r.merchant,
        description: r.description,
        category: r.category?.name ?? null,
        amount: formatMoney(r.amountMinor),
        amountMinor: r.amountMinor,
        source: r.source,
        status: r.status,
      })),
      total,
    });
  });
}
