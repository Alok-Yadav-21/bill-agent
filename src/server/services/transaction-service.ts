import { prisma } from "@/lib/db";
import { toMinorUnits } from "@/lib/money";
import { requireMembership, requireCapability, ForbiddenError } from "@/lib/authz";
import { canModifyTransaction, type Role } from "@/lib/permissions";
import {
  summariseLedger,
  type LedgerEntry,
} from "@/lib/ledger";
import { evaluateBudgetAlert } from "@/lib/budget";
import { Prisma } from "@prisma/client";

type TxnType = "CONTRIBUTION" | "EXPENSE" | "TRANSFER" | "REFUND" | "ADJUSTMENT";

interface CreateArgs {
  householdId: string;
  actorUserId: string;
  type: TxnType;
  amountMajor: number;
  isCredit?: boolean;
  merchant?: string;
  description?: string;
  categoryId?: string | null;
  counterpartyUserId?: string | null;
  occurredAt?: Date;
  onBehalfOfUserId?: string | null;
  source?: "MANUAL" | "RECEIPT" | "AI";
  status?: "CONFIRMED" | "PENDING";
  receiptId?: string;
}

const CONFIRMED_SELECT = {
  amountMinor: true, isCredit: true, type: true, status: true,
  userId: true, counterpartyUserId: true, categoryId: true, occurredAt: true,
} as const;

/**
 * Creates a ledger transaction inside a serializable transaction so concurrent
 * writes can't corrupt the derived balance. Enforces permissions on the server:
 * members may only record their OWN contributions/expenses; transfers,
 * adjustments and on-behalf-of entries require manager/admin.
 */
export async function createTransaction(args: CreateArgs) {
  const membership = await requireMembership(args.actorUserId, args.householdId);
  const role = membership.role as Role;

  // Attribution: who the money is for. Only managers/admins may attribute to
  // someone else.
  let attributedUserId = args.actorUserId;
  if (args.onBehalfOfUserId && args.onBehalfOfUserId !== args.actorUserId) {
    await requireCapability(args.actorUserId, args.householdId, "transaction.create.onBehalf");
    attributedUserId = args.onBehalfOfUserId;
  }

  // Type-specific permission gates.
  if (args.type === "TRANSFER") {
    await requireCapability(args.actorUserId, args.householdId, "transaction.create.transfer");
  } else if (args.type === "ADJUSTMENT") {
    await requireCapability(args.actorUserId, args.householdId, "transaction.create.adjustment");
  } else {
    // CONTRIBUTION / EXPENSE / REFUND — members may record their own.
    await requireCapability(args.actorUserId, args.householdId, "transaction.create.own");
  }

  // Transfers must target a real active member of this household.
  if (args.type === "TRANSFER") {
    if (!args.counterpartyUserId) throw new Error("Transfer needs a recipient.");
    const recipient = await prisma.householdMember.findFirst({
      where: { householdId: args.householdId, userId: args.counterpartyUserId, status: "ACTIVE" },
    });
    if (!recipient) throw new ForbiddenError("Recipient is not a member of this household.");
  }

  const amountMinor = toMinorUnits(args.amountMajor);
  if (amountMinor <= 0) throw new Error("Amount must be greater than 0");

  return prisma.$transaction(
    async (tx) => {
      const created = await tx.transaction.create({
        data: {
          householdId: args.householdId,
          userId: attributedUserId,
          counterpartyUserId: args.type === "TRANSFER" ? args.counterpartyUserId : null,
          categoryId: args.type === "EXPENSE" ? args.categoryId ?? null : null,
          type: args.type,
          status: args.status ?? "CONFIRMED",
          amountMinor,
          isCredit: args.type === "ADJUSTMENT" ? args.isCredit ?? true : true,
          merchant: args.merchant,
          description: args.description,
          occurredAt: args.occurredAt ?? new Date(),
          source: args.source ?? "MANUAL",
          receiptId: args.receiptId,
        },
      });

      await tx.auditLog.create({
        data: {
          householdId: args.householdId,
          userId: args.actorUserId,
          action: `transaction.create.${args.type.toLowerCase()}`,
          entityType: "Transaction",
          entityId: created.id,
          metadata: { amountMinor, type: args.type, attributedUserId },
        },
      });

      const summary = await recomputeAndAlert(tx, args.householdId);
      return { transaction: created, summary };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/** Void (never hard-delete) a transaction; keeps a permanent record. */
export async function voidTransaction(args: {
  householdId: string;
  actorUserId: string;
  transactionId: string;
  reason: string;
}) {
  const txn = await prisma.transaction.findFirst({
    where: { id: args.transactionId, householdId: args.householdId },
  });
  if (!txn) throw new Error("Transaction not found");
  if (txn.status === "VOID") throw new Error("Transaction is already void");

  const membership = await requireMembership(args.actorUserId, args.householdId);
  const isAuthor = txn.userId === args.actorUserId;
  if (!canModifyTransaction(membership.role as Role, isAuthor, "void")) {
    throw new ForbiddenError("You can't void this transaction.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: txn.id },
      data: { status: "VOID", voidReason: args.reason },
    });
    await tx.auditLog.create({
      data: {
        householdId: args.householdId, userId: args.actorUserId,
        action: "transaction.void", entityType: "Transaction", entityId: txn.id,
        metadata: { amountMinor: txn.amountMinor, reason: args.reason },
      },
    });
    return recomputeAndAlert(tx, args.householdId);
  });
}

/** Edit a transaction's editable fields (author or manager/admin). Audited. */
export async function editTransaction(args: {
  householdId: string;
  actorUserId: string;
  transactionId: string;
  changes: { amountMajor?: number; merchant?: string; description?: string; categoryId?: string | null; occurredAt?: Date };
}) {
  const txn = await prisma.transaction.findFirst({
    where: { id: args.transactionId, householdId: args.householdId },
  });
  if (!txn) throw new Error("Transaction not found");
  if (txn.status === "VOID") throw new Error("Cannot edit a void transaction");

  const membership = await requireMembership(args.actorUserId, args.householdId);
  const isAuthor = txn.userId === args.actorUserId;
  if (!canModifyTransaction(membership.role as Role, isAuthor, "edit")) {
    throw new ForbiddenError("You can't edit this transaction.");
  }

  const nextAmount = args.changes.amountMajor !== undefined ? toMinorUnits(args.changes.amountMajor) : txn.amountMinor;
  if (nextAmount <= 0) throw new Error("Amount must be greater than 0");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id: txn.id },
      data: {
        amountMinor: nextAmount,
        merchant: args.changes.merchant ?? txn.merchant,
        description: args.changes.description ?? txn.description,
        categoryId: args.changes.categoryId !== undefined ? args.changes.categoryId : txn.categoryId,
        occurredAt: args.changes.occurredAt ?? txn.occurredAt,
      },
    });
    await tx.auditLog.create({
      data: {
        householdId: args.householdId, userId: args.actorUserId,
        action: "transaction.edit", entityType: "Transaction", entityId: txn.id,
        metadata: { oldAmountMinor: txn.amountMinor, newAmountMinor: nextAmount },
      },
    });
    const summary = await recomputeAndAlert(tx, args.householdId);
    return { transaction: updated, summary };
  });
}

/** Recompute the ledger + budget alert from committed rows inside a txn. */
async function recomputeAndAlert(tx: Prisma.TransactionClient, householdId: string) {
  const [budget, rows] = await Promise.all([
    tx.budget.findFirst({ where: { householdId }, orderBy: { startDate: "desc" } }),
    tx.transaction.findMany({ where: { householdId, status: "CONFIRMED" }, select: CONFIRMED_SELECT }),
  ]);
  const summary = summariseLedger(rows as unknown as LedgerEntry[]);

  if (budget && budget.amountMinor > 0) {
    const percentUsed = (summary.totalExpensesMinor / budget.amountMinor) * 100;
    const alert = evaluateBudgetAlert(percentUsed);
    if (alert) {
      await tx.notification.create({
        data: {
          householdId, userId: null,
          type: `budget.threshold.${alert.threshold}`,
          title: "Budget alert", message: alert.message,
        },
      });
    }
  }
  return summary;
}
