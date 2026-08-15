import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { deleteExpense } from "@/server/services/expense-service";
import { ForbiddenError } from "@/lib/authz";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");
    const { id } = await ctx.params;

    try {
      await deleteExpense({ householdId, actorUserId: user.id, expenseId: id });
      return ok({ deleted: true });
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      if (err instanceof Error && err.message === "Expense not found")
        return fail("NOT_FOUND", err.message, 404);
      throw err;
    }
  });
}
