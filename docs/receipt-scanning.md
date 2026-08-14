# Receipt scanning

## Flow
1. User uploads a JPEG/PNG/WEBP (≤ 8MB) to `POST /api/receipts/process`.
2. Backend validates type/size, hashes bytes (sha256), checks for duplicates,
   creates a `Receipt` row (status PROCESSING).
3. Backend calls the configured `ReceiptProcessor` (n8n by default) to extract
   structured data. **No expense is created yet.**
4. Backend returns extracted data + any low-confidence warnings + a possible
   duplicate reference to the UI's confirmation screen.
5. User reviews/edits and calls `POST /api/receipts/confirm`. Only now is a
   **CONFIRMED** expense written (transactionally, audited).

## Decoupling
The backend depends on the `ReceiptProcessor` interface
(`src/server/services/receipt/types.ts`), not on n8n. Swap in Anthropic vision,
AWS Textract, or Google Document AI by implementing the interface and setting
`RECEIPT_PROCESSOR`.

## Safety
- Allowed types: JPEG, PNG, WEBP only. Max 8MB. Files are never executed.
- Never invents missing values — absent/low-confidence totals become warnings.
- Store receipt files in private object storage; only household members may read.
- Duplicate detection via file hash (+ merchant/date/amount heuristics to add).
