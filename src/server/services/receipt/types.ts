/**
 * Receipt processing abstraction.
 *
 * The application depends on THIS interface, never on n8n directly. n8n is just
 * one implementation. To swap in a direct Anthropic/OpenAI vision call, AWS
 * Textract, or Google Document AI later, you write a new class implementing
 * `ReceiptProcessor` and change one env var — no app code changes.
 *
 *   Application  ->  ReceiptProcessor (interface)  ->  {n8n | direct API | AWS | GCP}
 */

export interface ReceiptLineItem {
  name: string;
  amountMinor: number;
}

export interface ExtractedReceipt {
  merchant: string | null;
  /** ISO date string, e.g. "2026-08-14". Null if not confidently detected. */
  date: string | null;
  currency: string;
  subtotalMinor: number | null;
  taxMinor: number | null;
  totalMinor: number | null;
  suggestedCategory: string | null;
  items: ReceiptLineItem[];
  confidence: {
    merchant?: number;
    date?: number;
    total?: number;
  };
  /** Warnings surfaced to the user, e.g. low-confidence total. Never silently invent. */
  warnings: string[];
}

export interface ProcessReceiptInput {
  householdId: string;
  uploadedBy: string;
  /** Public or signed URL the processor can fetch, or a base64 data URL. */
  imageRef: string;
  mimeType: string;
}

export interface ReceiptProcessor {
  readonly name: string;
  process(input: ProcessReceiptInput): Promise<ExtractedReceipt>;
}

export class ReceiptProcessingError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ReceiptProcessingError";
  }
}
