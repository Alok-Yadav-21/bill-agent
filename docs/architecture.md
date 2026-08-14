# Architecture

## Layers

1. **Frontend** (Next.js App Router, `src/app`) — renders data, never trusted for
   money math. It calls backend APIs and displays formatted values.
2. **Backend / API** (`src/app/api/**`) — the only writer of the database. Every
   route: authenticates (`session.ts`), authorizes membership/role (`authz.ts`),
   validates input (`validation.ts` / Zod), and returns a consistent envelope
   (`api-response.ts`).
3. **Domain services** (`src/server/services`) — transactional business logic
   (`expense-service.ts`), plus the swappable `receipt` and `ai` services.
4. **PostgreSQL** (`prisma/schema.prisma`) — source of truth. Money as `Int`
   minor units. No stored remaining balance.

## Why n8n is not the backend

n8n is orchestration. It calls the backend's secure APIs and lets the backend
own writes and math. The service factories return a local fallback / null when
n8n is absent, so core budgeting never depends on it. This satisfies the
requirement: *"Do NOT allow n8n to directly become the database/business-logic
layer."*

## Swappability

`ReceiptProcessor` and `AiAssistant` are interfaces with env-driven factories.
Replacing n8n with a direct API, AWS Textract, Google Document AI, or a different
model is a new class + one env var — no changes to routes, UI, or schema.

## Source-of-truth guarantee for AI

The AI answers financial questions only through `aiTools` (`src/server/services/
ai/tools.ts`), which run authorized DB queries and reuse `budget.ts`. The model
cannot produce a number the dashboard wouldn't.

## Milestones

- M1 Foundation: schema, auth interface, households, users ✅ (schema/authz done)
- M2 Budget/expenses/dashboard/calculations ✅ (engine, routes, dashboard)
- M3 Receipt upload/processing/confirmation ✅ (routes + service; storage TODO)
- M4 n8n + AI assistant + NL queries ✅ (local assistant + n8n workflows; direct
  LLM impl TODO)
- M5 Analytics/reports/notifications/alerts — partial (threshold notifs done)
- M6 Security/testing/error handling/polish — partial (financial tests done; expand)
