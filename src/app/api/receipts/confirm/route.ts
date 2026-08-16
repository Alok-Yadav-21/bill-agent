import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { confirmReceiptSchema } from "@/lib/validation";
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
    try {
      await requireMembership(user.id, householdId);
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      throw err;
    }

    const body = await req.json().catch(() => null);
    const parsed = confirmReceiptSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input", 422);

    const receipt = await prisma.receipt.findFirst({ where: { id: parsed.data.receiptId, householdId } });
    if (!receipt) return fail("NOT_FOUND", "Receipt not found", 404);

    // A receipt links to exactly one ledger transaction.
    const already = await prisma.transaction.findFirst({ where: { receiptId: receipt.id } });
    if (already) return fail("ALREADY_CONFIRMED", "This receipt already has a transaction.", 409);

    // Scanned receipts become a CONFIRMED EXPENSE in the ledger after the user
    // confirms — so they affect the household's available balance.
    const { transaction, summary } = await createTransaction({
      householdId,
      actorUserId: user.id,
      type: "EXPENSE",
      amountMajor: parsed.data.amount,
      merchant: parsed.data.merchant ?? receipt.merchant ?? undefined,
      categoryId: parsed.data.categoryId ?? null,
      occurredAt: parsed.data.purchaseDate ?? receipt.receiptDate ?? undefined,
      source: "RECEIPT",
      status: "CONFIRMED",
      receiptId: receipt.id,
    });

    return ok({ transaction, availableBalance: formatMoney(summary.availableBalanceMinor) }, 201);
  });
}
