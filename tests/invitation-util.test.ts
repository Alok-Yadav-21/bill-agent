import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normaliseEmail,
  inviteMatchesUser,
  isExpired,
  makeInviteToken,
  defaultInviteExpiry,
} from "../src/server/services/invitation-util.ts";

test("email normalisation is case- and space-insensitive", () => {
  assert.equal(normaliseEmail("  Alok@Example.COM "), "alok@example.com");
});

test("invite only matches the exact invited email", () => {
  assert.equal(inviteMatchesUser("alok@example.com", " ALOK@example.com "), true);
  assert.equal(inviteMatchesUser("alok@example.com", "someone@else.com"), false);
});

test("expiry check works both ways", () => {
  const past = new Date(Date.now() - 1000);
  const future = new Date(Date.now() + 1000);
  assert.equal(isExpired(past), true);
  assert.equal(isExpired(future), false);
});

test("default expiry is 14 days out", () => {
  const from = new Date("2026-08-01T00:00:00Z");
  const exp = defaultInviteExpiry(from);
  assert.equal(exp.toISOString(), "2026-08-15T00:00:00.000Z");
});

test("tokens are non-empty and unique", () => {
  const a = makeInviteToken();
  const b = makeInviteToken();
  assert.ok(a.length >= 20);
  assert.notEqual(a, b);
});
