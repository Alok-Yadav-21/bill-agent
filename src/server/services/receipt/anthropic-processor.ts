import {
  type ReceiptProcessor,
  type ProcessReceiptInput,
  type ExtractedReceipt,
  ReceiptProcessingError,
} from "./types";

/**
 * Reads receipts with Anthropic's vision models via the Messages API.
 * Implements the same ReceiptProcessor interface as the n8n processor, so it is
 * a drop-in replacement selected by RECEIPT_PROCESSOR=anthropic. No app, route
 * or UI changes are needed to switch providers.
 *
 * The model only EXTRACTS structured data; the backend validates it and the
 * user confirms before any expense is written. The model never touches money
 * math or the database.
 */
export class AnthropicReceiptProcessor implements ReceiptProcessor {
  readonly name = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs = 30_000,
  ) {}

  async process(input: ProcessReceiptInput): Promise<ExtractedReceipt> {
    const { mediaType, base64 } = splitDataUrl(input.imageRef, input.mimeType);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mediaType, data: base64 },
                },
                { type: "text", text: PROMPT },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ReceiptProcessingError(
          `Anthropic API returned ${res.status}: ${detail.slice(0, 200)}`,
        );
      }

      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text =
        data.content?.find((b) => b.type === "text")?.text ?? "{}";
      return normalise(parseJson(text));
    } catch (err) {
      if (err instanceof ReceiptProcessingError) throw err;
      throw new ReceiptProcessingError("Failed to reach Anthropic", err);
    } finally {
      clearTimeout(timer);
    }
  }
}

const PROMPT = `You are a receipt parser. Read the attached receipt image and return ONLY strict JSON, no prose, no markdown.
Use integer minor units (pence) for ALL money values (e.g. £14.00 -> 1400).
Shape:
{
  "merchant": string|null,
  "date": "YYYY-MM-DD"|null,
  "currency": "GBP",
  "subtotal_minor": number|null,
  "tax_minor": number|null,
  "total_minor": number|null,
  "category": string|null,
  "items": [{ "name": string, "amount_minor": number }],
  "confidence": { "merchant": number, "date": number, "total": number },
  "warnings": string[]
}
Never invent missing values: use null and add a short note to "warnings". Confidence values are 0..1.`;

function splitDataUrl(imageRef: string, fallbackMime: string) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(imageRef);
  if (m) return { mediaType: m[1], base64: m[2] };
  // If it wasn't a data URL, assume the caller passed raw base64.
  return { mediaType: fallbackMime, base64: imageRef };
}

function parseJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to salvage the first {...} block.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    return { warnings: ["Could not parse the receipt output."] };
  }
}

/** Defensive normalisation — identical contract to the n8n processor. */
function normalise(raw: unknown): ExtractedReceipt {
  const r = (raw ?? {}) as Record<string, unknown>;
  const conf = (r.confidence ?? {}) as Record<string, unknown>;
  const warnings: string[] = Array.isArray(r.warnings) ? (r.warnings as string[]) : [];

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
const intOrNull = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : null);
const numOrUndef = (v: unknown) => (typeof v === "number" ? v : undefined);
