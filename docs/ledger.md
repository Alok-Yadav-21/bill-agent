# The household ledger

Bill Agent is a shared household financial record system built on a single
**transaction ledger**. The household's **available balance is always derived**
from CONFIRMED transactions — it is never stored.

## Transaction types
| Type | Effect on balance | Who can create |
| --- | --- | --- |
| CONTRIBUTION | + money in | any member (own) |
| EXPENSE | − money out | any member (own) |
| REFUND | + money in | any member (own) |
| TRANSFER | 0 to household; moves between members | manager/admin |
| ADJUSTMENT | +/- (isCredit) | manager/admin |

Money is integer minor units (pence); never a float. `available balance = Σ money in − Σ money out` over CONFIRMED rows (see `src/lib/ledger.ts`, fully unit-tested).

## Status
- CONFIRMED — counts toward the balance.
- PENDING — awaiting approval; excluded.
- VOID — reversed but kept permanently for the record (transactions are **voided, never hard-deleted**), with a reason and an audit entry.

## Every transaction records
who (member) → what (type) → amount → date → category → receipt → status → created/updated → (for transfers) counterparty. Voids also record the reason.

## Roles (backend-enforced)
Defined in `src/lib/permissions.ts` and enforced in `authz.ts` + the services — never by hidden buttons.
- **ADMIN** (owner): everything — household, budget, members, categories, any transaction, approvals, audit.
- **MANAGER** (finance manager): budget, categories, transfers, adjustments, edit/void/approve any transaction, view audit — but **cannot** add/remove members or delete the household.
- **MEMBER**: record and edit/void **their own** contributions/expenses, upload receipts, view. Cannot change the budget, touch other members' transactions, or manage members.

## Audit trail
Every create/edit/void writes an `AuditLog` row (who, action, entity, old/new values, timestamp). Permanent.

## Migration from the old model
Existing `Expense` rows are copied into the ledger as `EXPENSE` transactions by
`prisma/migrate-expenses-to-transactions.ts` (idempotent). After migrating, the
ledger is authoritative; the legacy `/expenses` page is superseded by
`/transactions`.
