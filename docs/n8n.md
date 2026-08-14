# n8n integration

n8n is an **optional automation and AI-orchestration layer**. The app never
depends on it for core financial operations.

## Golden rule
n8n calls backend APIs. n8n does **not** connect to the database and does **not**
compute money. Financial figures always come from the backend.

## Workflows (`n8n/workflows`)
- `receipt-processing.json` — verifies the shared API key, runs Vision AI, returns
  structured JSON to the backend. Real, importable.
- `budget-monitoring.json` — scheduled; reads budget status from the backend and
  asks the backend to create notifications. Contains no math.
- `expense-creation.json`, `weekly-report.json`, `monthly-report.json`,
  `ai-assistant.json` — scaffolds to complete in M4/M5.

## Contract
- Every webhook checks header `x-api-key` against `N8N_API_KEY`.
- Scheduled workflows call `APP_BASE_URL/api/internal/*` with the same key.
  (Those internal endpoints are a documented TODO — they must verify the key and
  never accept client-supplied ids.)

## Required env
`N8N_API_KEY`, `AI_API_KEY` (for vision), `APP_BASE_URL` (for scheduled workflows).
