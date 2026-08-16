import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * One-time backfill: copy existing Expense rows into the new Transaction ledger
 * as type=EXPENSE, preserving amount, member, category, date and status.
 * Safe to re-run: skips expenses already migrated (matched by receiptId or a
 * marker in description is not used; we track via a set of existing txn ids).
 */
async function main() {
  const expenses = await prisma.expense.findMany();
  console.log(`Found ${expenses.length} expenses to migrate.`);

  let created = 0;
  for (const e of expenses) {
    // Avoid duplicates: if a transaction already exists with same household,
    // user, amount, date and type EXPENSE, skip.
    const exists = await prisma.transaction.findFirst({
      where: {
        householdId: e.householdId, userId: e.userId, type: "EXPENSE",
        amountMinor: e.amountMinor, occurredAt: e.purchaseDate,
      },
    });
    if (exists) continue;

    await prisma.transaction.create({
      data: {
        householdId: e.householdId,
        userId: e.userId,
        categoryId: e.categoryId,
        type: "EXPENSE",
        status: e.status === "CANCELLED" ? "VOID" : e.status === "PENDING" ? "PENDING" : "CONFIRMED",
        amountMinor: e.amountMinor,
        currency: e.currency,
        merchant: e.merchant,
        description: e.description,
        occurredAt: e.purchaseDate,
        source: e.source,
      },
    });
    created++;
  }
  console.log(`Migrated ${created} expenses into the ledger.`);
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
