# Database

PostgreSQL via Prisma. Full model in `prisma/schema.prisma`.

## Money
All monetary columns are `Int` minor units (pence). Never floats. Formatting to
`£x.yz` happens only at display time via `src/lib/money.ts`.

## Remaining budget
There is deliberately **no** `remaining_budget` column. Remaining is computed:
`total_budget - sum(amountMinor where status = CONFIRMED)`.

## Key tables
- `User`, `Household`, `HouseholdMember` (join; unique `(householdId, userId)`;
  supports any number of members — no cap).
- `Budget` (per household, per period, `amountMinor`).
- `Expense` (`amountMinor`, `status` CONFIRMED/PENDING/CANCELLED, `source`).
- `ExpenseCategory` (household-scoped or global when `householdId` is null).
- `Receipt` (`fileHash` for duplicate detection, `extractedData` JSON).
- `Notification`, `AuditLog`.

## Integrity
- FKs with sensible `onDelete` (Cascade for household children; Restrict on the
  expense author so users with history aren't silently removed).
- Composite indexes tuned for dashboard aggregation:
  `Expense(householdId, status, purchaseDate)`.
- Recommended migration CHECK: `amountMinor > 0` on `Expense` and `Budget`.
- Concurrent writes use a **Serializable** transaction (see expense-service).
