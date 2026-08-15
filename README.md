# Bill Agent

A shared household budget and expense manager. Multiple members record spending;
the remaining budget is always **derived from the database**, never stored or
edited directly. AI and n8n are optional layers that _assist_ — they are never
the source of truth.

## Architecture at a glance

```
Frontend (Next.js)
      │
      ▼
Application Backend / API  ──────────►  PostgreSQL  ← source of truth
 (Zod validation, authz,                 (money = integer minor units)
  transactional writes)
      │
      ├── ReceiptProcessor (interface) ──► { n8n | Anthropic | Textract | ... }
      └── AiAssistant     (interface) ──► { local | n8n | direct LLM }
                                    │
                                    └── DB-backed tools (reuse budget engine)

        ┌──────────────────────────┐
        │            n8n           │  optional: receipt OCR, alerts, reports
        │   calls backend APIs     │  NEVER writes the DB directly
        └──────────────────────────┘
```

**If n8n is offline, the app still works**: login, dashboard, add/edit/delete
expenses, correct remaining budget, reports. Receipt scanning and AI simply
degrade (the UI can hide them). This is enforced by the service factories in
`src/server/services/*/index.ts`, which return `null`/a local fallback when a
provider isn't configured.

## What lives where

| Concern | Home |
| --- | --- |
| Budget, expenses, totals, remaining, member/category spend | **PostgreSQL + backend** (`src/lib/budget.ts`, `src/server/services/expense-service.ts`) |
| Auth, membership, roles, isolation | **Backend** (`src/lib/authz.ts`, `src/lib/session.ts`) |
| Receipt OCR/vision extraction | **AI**, behind `ReceiptProcessor` |
| Natural-language answers | **AI**, behind `AiAssistant` + DB tools |
| Notifications, scheduled reports, alert delivery | **n8n** (calls backend APIs) |
| Financial math | **Never** the AI or n8n |

## Money rule

Money is stored and computed only as integer minor units (pence). `£42.50` → `4250`.
No floats, no `Decimal`, no `remaining_budget` column. See `src/lib/money.ts`.

## Financial core is tested

```
npm install        # or: npm i -D tsx  (already used for the test runner)
npm test
```

The suite in `tests/budget.test.ts` verifies the acceptance scenario directly:
£5,000 budget − (£80 + £35 + £120) = **£4,765**, plus float-safety, thresholds
(70/80/90/100), overspend, affordability, and member ranking. All pass.

## Local setup

1. `npm install`
2. Copy `.env.example` → `.env` and fill `DATABASE_URL`.
3. `npm run db:push` (or `db:migrate`) then `npm run db:seed`
   - Seed builds "London Household" with a **configurable** member count
     (`SEED_MEMBERS=14` by default — change to 50/100, no code changes).
4. Wire auth: implement `getSessionUser` in `src/lib/session.ts` for your
   provider (Supabase Auth / Auth.js / Clerk). It must derive identity from a
   verified server session — never a client-supplied id.
5. `npm run dev`

## Optional: enable receipt scanning + AI via n8n

- Import `n8n/workflows/*.json` into your n8n instance.
- Set `RECEIPT_PROCESSOR=n8n`, `N8N_RECEIPT_WEBHOOK_URL`, `N8N_API_KEY`.
- To switch providers later, implement the interface and change the env var.
  See `docs/n8n.md` and `docs/receipt-scanning.md`.

## Build status (honest)

**Done and verified:** Supabase Auth wired end-to-end (login/register/logout,
session middleware, auth→User mapping with passing mapper tests), money engine,
budget/derivation engine (+ passing tests),
Prisma schema, service abstractions (receipt + AI), authz guard, transactional
expense service with audit + threshold notifications, core API routes
(`expenses`, `expenses/:id`, `budget`, `dashboard`, `ai/query`,
`receipts/process`, `receipts/confirm`), duplicate detection, dashboard UI,
seed, n8n receipt + budget-monitor workflows, docs.

**Scaffolded / next milestones:** object storage for receipt
files, remaining UI pages (expenses table, scan, members, categories, reports,
assistant chat), the internal `/api/internal/*` endpoints n8n calls, the
remaining n8n workflow bodies, invitations, and CI. See `docs/architecture.md`
for the milestone plan.
