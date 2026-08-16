/**
 * Permission matrix — the single definition of what each role may do.
 *
 * This is pure and unit-tested. The BACKEND enforces it on every request
 * (see authz.ts and the services); the frontend only uses it to hide buttons.
 * Hiding a button is never the security boundary.
 *
 * Roles:
 *   ADMIN   — the household owner(s): full control.
 *   MANAGER — finance manager: manage money, categories, approve, void, but
 *             cannot add/remove members or delete the household.
 *   MEMBER  — can record their own contributions/expenses and view, nothing else.
 */

export type Role = "ADMIN" | "MANAGER" | "MEMBER";

export type Capability =
  | "household.manage" // rename/delete household
  | "budget.manage" // set/change budget
  | "member.manage" // add/remove members, change roles
  | "category.manage"
  | "transaction.create.own" // add own contribution/expense
  | "transaction.create.onBehalf" // create for another member
  | "transaction.create.transfer"
  | "transaction.create.adjustment"
  | "transaction.edit.own"
  | "transaction.edit.any"
  | "transaction.void.own"
  | "transaction.void.any"
  | "transaction.approve" // approve/reject PENDING
  | "audit.view"
  | "reports.view";

const MATRIX: Record<Role, Set<Capability>> = {
  ADMIN: new Set<Capability>([
    "household.manage",
    "budget.manage",
    "member.manage",
    "category.manage",
    "transaction.create.own",
    "transaction.create.onBehalf",
    "transaction.create.transfer",
    "transaction.create.adjustment",
    "transaction.edit.own",
    "transaction.edit.any",
    "transaction.void.own",
    "transaction.void.any",
    "transaction.approve",
    "audit.view",
    "reports.view",
  ]),
  MANAGER: new Set<Capability>([
    "budget.manage",
    "category.manage",
    "transaction.create.own",
    "transaction.create.onBehalf",
    "transaction.create.transfer",
    "transaction.create.adjustment",
    "transaction.edit.own",
    "transaction.edit.any",
    "transaction.void.own",
    "transaction.void.any",
    "transaction.approve",
    "audit.view",
    "reports.view",
  ]),
  MEMBER: new Set<Capability>([
    "transaction.create.own",
    "transaction.edit.own",
    "transaction.void.own",
    "reports.view",
  ]),
};

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[role].has(capability);
}

/**
 * Whether `role` may edit/void a transaction, given whether they authored it.
 * Members may only touch their own; managers/admins may touch any.
 */
export function canModifyTransaction(
  role: Role,
  isAuthor: boolean,
  action: "edit" | "void",
): boolean {
  if (can(role, action === "edit" ? "transaction.edit.any" : "transaction.void.any")) return true;
  if (isAuthor && can(role, action === "edit" ? "transaction.edit.own" : "transaction.void.own")) return true;
  return false;
}
