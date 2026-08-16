import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { voidTransactionSchema } from "@/lib/validation";
import { voidTransaction } from "@/server/services/transaction-service";
import { ForbiddenError } from "@/lib/authz";
import { formatMoney } from "@/lib/money";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");
    const { id } = await ctx.params;

    const body = await req.json().catch(() => null);
    const parsed = voidTransactionSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", "A reason is required to void.", 422);

    try {
      const summary = await voidTransaction({ householdId, actorUserId: user.id, transactionId: id, reason: parsed.data.reason });
      return ok({ voided: true, availableBalance: formatMoney(summary.availableBalanceMinor) });
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      if (err instanceof Error && err.message.includes("not found")) return fail("NOT_FOUND", err.message, 404);
      if (err instanceof Error) return fail("BAD_REQUEST", err.message, 400);
      throw err;
    }
  });
}
