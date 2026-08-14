import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { requireMembership, ForbiddenError } from "@/lib/authz";
import { getReceiptProcessor } from "@/server/services/receipt";
import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: Request) {
  return guarded(async () => {
    const user = await requireUser(req);
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");
    try {
      await requireMembership(user.id, householdId);
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      throw err;
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return fail("BAD_REQUEST", "A receipt image file is required");
    if (!ALLOWED.has(file.type)) return fail("UNSUPPORTED_TYPE", "Only JPEG, PNG or WEBP allowed", 415);
    if (file.size > MAX_BYTES) return fail("TOO_LARGE", "Max file size is 8MB", 413);

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(bytes).digest("hex");

    // Duplicate detection: same file bytes previously uploaded to this household.
    const priorSameFile = await prisma.receipt.findFirst({
      where: { householdId, fileHash },
      include: { expense: { select: { id: true, amountMinor: true } } },
    });

    const processor = getReceiptProcessor();
    if (!processor) {
      // Core app still works: tell the client to fall back to manual entry.
      return fail(
        "RECEIPT_UNAVAILABLE",
        "Receipt scanning is not configured. You can still add this expense manually.",
        503,
      );
    }

    // TODO storage: persist `bytes` to Supabase Storage / S3, get a signed URL.
    const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;

    const receipt = await prisma.receipt.create({
      data: {
        householdId,
        uploadedBy: user.id,
        fileUrl: "pending-storage", // replaced with real URL once storage wired
        fileHash,
        processingStatus: "PROCESSING",
      },
    });

    try {
      const extracted = await processor.process({
        householdId,
        uploadedBy: user.id,
        imageRef: dataUrl,
        mimeType: file.type,
      });
      await prisma.receipt.update({
        where: { id: receipt.id },
        data: {
          processingStatus: "PROCESSED",
          merchant: extracted.merchant,
          totalMinor: extracted.totalMinor,
          taxMinor: extracted.taxMinor,
          receiptDate: extracted.date ? new Date(extracted.date) : null,
          extractedData: extracted as unknown as object,
        },
      });
      return ok({
        receiptId: receipt.id,
        extracted,
        possibleDuplicate: priorSameFile
          ? { receiptId: priorSameFile.id, expenseId: priorSameFile.expense?.id ?? null }
          : null,
      });
    } catch (err) {
      await prisma.receipt.update({ where: { id: receipt.id }, data: { processingStatus: "FAILED" } });
      console.error("[receipts/process]", err);
      return fail("PROCESSING_FAILED", "Could not read the receipt. Please try again or enter manually.", 502);
    }
  });
}
