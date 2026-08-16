import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { createTransactionSchema } from "@/lib/validation";
import { requireMembership, ForbiddenError } from "@/lib/authz";
import { createTransaction } from "@/server/services/transaction-service";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export async function POST(req: Request) {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");

    const body = await req.json().catch(() => null);
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input", 422);

    try {
      const { transaction, summary } = await createTransaction({
        householdId,
        actorUserId: user.id,
        type: parsed.data.type,
        amountMajor: parsed.data.amount,
        isCredit: parsed.data.isCredit,
        merchant: parsed.data.merchant,
        description: parsed.data.description,
        categoryId: parsed.data.categoryId ?? null,
        counterpartyUserId: parsed.data.counterpartyUserId ?? null,
        occurredAt: parsed.data.occurredAt,
        onBehalfOfUserId: parsed.data.onBehalfOfUserId ?? null,
      });
      return ok({ transaction, availableBalance: formatMoney(summary.availableBalanceMinor) }, 201);
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      if (err instanceof Error) return fail("BAD_REQUEST", err.message, 400);
      throw err;
    }
  });
}

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

    const url = new URL(req.url);
    const take = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const skip = Number(url.searchParams.get("offset") ?? 0);
    const type = url.searchParams.get("type") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const memberId = url.searchParams.get("memberId") ?? undefined;
    const categoryId = url.searchParams.get("categoryId") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;

    const where = {
      householdId,
      ...(type ? { type: type as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(memberId ? { userId: memberId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(search ? { merchant: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        take, skip,
        include: {
          user: { select: { name: true } },
          counterparty: { select: { name: true } },
          category: { select: { name: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return ok({
      transactions: rows.map((r) => ({
        id: r.id, date: r.occurredAt, type: r.type, status: r.status,
        member: r.user.name, counterparty: r.counterparty?.name ?? null,
        merchant: r.merchant, description: r.description,
        category: r.category?.name ?? null,
        amount: formatMoney(r.amountMinor), amountMinor: r.amountMinor,
        isCredit: r.isCredit, source: r.source, voidReason: r.voidReason,
      })),
      total,
    });
  });
}
