import { z } from "zod";

/** Money comes in as a major-unit string/number; convert to minor server-side. */
export const moneyMajor = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const n = typeof v === "string" ? Number(v.trim()) : v;
    if (!Number.isFinite(n) || n <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount must be greater than 0" });
      return z.NEVER;
    }
    return n;
  });

export const createExpenseSchema = z.object({
  amount: moneyMajor,
  merchant: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  categoryId: z.string().cuid().optional().nullable(),
  purchaseDate: z.coerce.date().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const setBudgetSchema = z.object({
  amount: moneyMajor,
  periodType: z.enum(["MONTHLY", "WEEKLY", "CUSTOM"]).default("MONTHLY"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

/** Edit an existing budget in place. All fields optional; amount still > 0. */
export const updateBudgetSchema = z
  .object({
    budgetId: z.string().cuid(),
    amount: moneyMajor.optional(),
    periodType: z.enum(["MONTHLY", "WEEKLY", "CUSTOM"]).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (v) => v.amount !== undefined || v.periodType || v.startDate || v.endDate,
    { message: "Provide at least one field to update" },
  );

export const aiQuerySchema = z.object({
  message: z.string().min(1).max(500),
});

export const confirmReceiptSchema = z.object({
  receiptId: z.string().cuid(),
  amount: moneyMajor,
  merchant: z.string().max(200).optional(),
  categoryId: z.string().cuid().optional().nullable(),
  purchaseDate: z.coerce.date().optional(),
  forceCreate: z.boolean().optional(), // override duplicate warning
});

export const createHouseholdSchema = z.object({
  name: z.string().min(1).max(120),
  currency: z.enum(["GBP", "USD", "EUR"]).default("GBP"),
  // Optional first budget created together with the household.
  budget: z
    .object({
      amount: moneyMajor,
      periodType: z.enum(["MONTHLY", "WEEKLY", "CUSTOM"]).default("MONTHLY"),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
    })
    .optional(),
});

export const createInvitationSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(10).max(200),
});

export const txnTypeEnum = z.enum(["CONTRIBUTION", "EXPENSE", "TRANSFER", "REFUND", "ADJUSTMENT"]);

export const createTransactionSchema = z
  .object({
    type: txnTypeEnum,
    amount: moneyMajor,
    isCredit: z.boolean().optional(), // ADJUSTMENT direction
    merchant: z.string().max(200).optional(),
    description: z.string().max(1000).optional(),
    categoryId: z.string().cuid().optional().nullable(),
    counterpartyUserId: z.string().cuid().optional().nullable(), // TRANSFER recipient
    occurredAt: z.coerce.date().optional(),
    onBehalfOfUserId: z.string().cuid().optional().nullable(), // admin/manager attributing to a member
  })
  .refine((v) => v.type !== "TRANSFER" || !!v.counterpartyUserId, {
    message: "A transfer needs a recipient member.",
    path: ["counterpartyUserId"],
  });

export const updateTransactionSchema = z.object({
  amount: moneyMajor.optional(),
  merchant: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  categoryId: z.string().cuid().optional().nullable(),
  occurredAt: z.coerce.date().optional(),
});

export const voidTransactionSchema = z.object({
  reason: z.string().min(1).max(300),
});

export const resetHouseholdSchema = z.object({
  confirm: z.string().min(1), // must equal the household name
});
