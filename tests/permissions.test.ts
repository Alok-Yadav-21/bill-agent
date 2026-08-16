import { test } from "node:test";
import assert from "node:assert/strict";
import { can, canModifyTransaction } from "../src/lib/permissions.ts";

test("ADMIN can manage members and household", () => {
  assert.equal(can("ADMIN", "member.manage"), true);
  assert.equal(can("ADMIN", "household.manage"), true);
  assert.equal(can("ADMIN", "budget.manage"), true);
});

test("MANAGER manages money but NOT members or household", () => {
  assert.equal(can("MANAGER", "budget.manage"), true);
  assert.equal(can("MANAGER", "category.manage"), true);
  assert.equal(can("MANAGER", "transaction.approve"), true);
  assert.equal(can("MANAGER", "member.manage"), false);
  assert.equal(can("MANAGER", "household.manage"), false);
});

test("MEMBER can only touch their own and cannot manage", () => {
  assert.equal(can("MEMBER", "transaction.create.own"), true);
  assert.equal(can("MEMBER", "budget.manage"), false);
  assert.equal(can("MEMBER", "member.manage"), false);
  assert.equal(can("MEMBER", "transaction.edit.any"), false);
  assert.equal(can("MEMBER", "transaction.create.adjustment"), false);
});

test("members can edit their own but not others'", () => {
  assert.equal(canModifyTransaction("MEMBER", true, "edit"), true);
  assert.equal(canModifyTransaction("MEMBER", false, "edit"), false);
  assert.equal(canModifyTransaction("MEMBER", false, "void"), false);
});

test("managers and admins can modify anyone's transaction", () => {
  assert.equal(canModifyTransaction("MANAGER", false, "void"), true);
  assert.equal(canModifyTransaction("ADMIN", false, "edit"), true);
});
