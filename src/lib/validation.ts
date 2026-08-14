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
