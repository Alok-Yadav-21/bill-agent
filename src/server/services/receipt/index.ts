import { type ReceiptProcessor } from "./types";
import { N8nReceiptProcessor } from "./n8n-processor";

export * from "./types";

/**
 * Chooses the receipt processor from env at runtime. Adding a new provider is:
 *   1. write a class implementing ReceiptProcessor
 *   2. add a case here
 *   3. set RECEIPT_PROCESSOR=<name>
 * No other app code changes.
 *
 * Returns null when no processor is configured — the app still runs, receipt
 * scanning is simply unavailable and the UI can hide/disable the feature. Core
 * budgeting never depends on this.
 */
export function getReceiptProcessor(): ReceiptProcessor | null {
  const provider = process.env.RECEIPT_PROCESSOR ?? "n8n";

  switch (provider) {
    case "n8n": {
      const url = process.env.N8N_RECEIPT_WEBHOOK_URL;
      const key = process.env.N8N_API_KEY;
      if (!url || !key) return null;
      return new N8nReceiptProcessor(url, key);
    }
    // case "anthropic": return new AnthropicReceiptProcessor(...);
    // case "textract":  return new AwsTextractProcessor(...);
    default:
      return null;
  }
}
