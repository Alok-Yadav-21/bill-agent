import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { updateTransactionSchema } from "@/lib/validation";
import { editTransaction } from "@/server/services/transaction-service";
import { ForbiddenError } from "@/lib/authz";
import { formatMoney } from "@/lib/money";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");
    const { id } = await ctx.params;

    const body = await req.json().catch(() => null);
    const parsed = updateTransactionSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input", 422);

    try {
      const { transaction, summary } = await editTransaction({
        householdId, actorUserId: user.id, transactionId: id,
        changes: {
          amountMajor: parsed.data.amount,
          merchant: parsed.data.merchant,
          description: parsed.data.description,
          categoryId: parsed.data.categoryId,
          occurredAt: parsed.data.occurredAt,
        },
      });
      return ok({ transaction, availableBalance: formatMoney(summary.availableBalanceMinor) });
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      if (err instanceof Error && err.message.includes("not found")) return fail("NOT_FOUND", err.message, 404);
      if (err instanceof Error) return fail("BAD_REQUEST", err.message, 400);
      throw err;
    }
  });
}
