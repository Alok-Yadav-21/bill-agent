import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { confirmReceiptSchema } from "@/lib/validation";
import { requireMembership, ForbiddenError } from "@/lib/authz";
import { createExpense } from "@/server/services/expense-service";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

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
    const parsed = confirmReceiptSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input", 422);

    const receipt = await prisma.receipt.findFirst({
      where: { id: parsed.data.receiptId, householdId },
    });
    if (!receipt) return fail("NOT_FOUND", "Receipt not found", 404);
    if (receipt.expenseId ?? (await prisma.expense.findFirst({ where: { receiptId: receipt.id } }))) {
      return fail("ALREADY_CONFIRMED", "This receipt already has an expense.", 409);
    }

    // The expense only becomes CONFIRMED here, after explicit user confirmation.
    const { expense, summary } = await createExpense({
      householdId,
      actorUserId: user.id,
      amountMajor: parsed.data.amount,
      merchant: parsed.data.merchant ?? receipt.merchant ?? undefined,
      categoryId: parsed.data.categoryId ?? null,
      purchaseDate: parsed.data.purchaseDate ?? receipt.receiptDate ?? undefined,
      source: "RECEIPT",
      status: "CONFIRMED",
      receiptId: receipt.id,
    });

    return ok({ expense, remaining: summary ? formatMoney(summary.remainingMinor) : null }, 201);
  });
}
