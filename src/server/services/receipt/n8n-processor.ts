import {
  type ReceiptProcessor,
  type ProcessReceiptInput,
  type ExtractedReceipt,
  ReceiptProcessingError,
} from "./types";

/**
 * Calls an n8n "Receipt Processing" webhook that runs OCR/Vision AI and returns
 * structured JSON. n8n is orchestration only — it returns extracted data to the
 * backend, which validates it and (after user confirmation) writes the expense.
 * n8n never writes to the database itself.
 */
export class N8nReceiptProcessor implements ReceiptProcessor {
  readonly name = "n8n";

  constructor(
    private readonly webhookUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs = 30_000,
  ) {}

  async process(input: ProcessReceiptInput): Promise<ExtractedReceipt> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new ReceiptProcessingError(
          `n8n receipt webhook returned ${res.status}`,
        );
      }
      const raw = (await res.json()) as unknown;
      return normalise(raw);
    } catch (err) {
      if (err instanceof ReceiptProcessingError) throw err;
      throw new ReceiptProcessingError("Failed to reach receipt processor", err);
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Defensive normalisation. The AI/OCR output is untrusted: coerce shape, never
 * invent missing fields, and attach a warning when the total is low-confidence
 * or absent so the confirmation screen can flag it.
 */
function normalise(raw: unknown): ExtractedReceipt {
  const r = (raw ?? {}) as Record<string, unknown>;
  const conf = (r.confidence ?? {}) as Record<string, unknown>;
  const warnings: string[] = Array.isArray(r.warnings)
    ? (r.warnings as string[])
    : [];

  const totalMinor = intOrNull(r.total_minor);
  const totalConfidence = numOrUndef(conf.total);
  if (totalMinor === null) {
    warnings.push("Receipt total could not be detected. Please enter it manually.");
  } else if (totalConfidence !== undefined && totalConfidence < 0.85) {
    warnings.push("Receipt total could not be confidently detected. Please verify.");
  }

  return {
    merchant: strOrNull(r.merchant),
    date: strOrNull(r.date),
    currency: typeof r.currency === "string" ? r.currency : "GBP",
    subtotalMinor: intOrNull(r.subtotal_minor),
    taxMinor: intOrNull(r.tax_minor),
    totalMinor,
    suggestedCategory: strOrNull(r.category),
    items: Array.isArray(r.items)
      ? (r.items as Record<string, unknown>[])
          .map((it) => ({
            name: typeof it.name === "string" ? it.name : "Item",
            amountMinor: intOrNull(it.amount_minor) ?? 0,
          }))
          .filter((it) => it.name)
      : [],
    confidence: {
      merchant: numOrUndef(conf.merchant),
      date: numOrUndef(conf.date),
      total: totalConfidence,
    },
    warnings,
  };
}

const strOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const intOrNull = (v: unknown) =>
  typeof v === "number" && Number.isInteger(v) ? v : null;
const numOrUndef = (v: unknown) => (typeof v === "number" ? v : undefined);
