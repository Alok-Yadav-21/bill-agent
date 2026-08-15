import { test } from "node:test";
import assert from "node:assert/strict";
import { mapSupabaseUserToProfile } from "../src/server/services/user-mapper.ts";

test("uses metadata name when present", () => {
  const p = mapSupabaseUserToProfile({
    id: "auth-123",
    email: "Alok@Example.com",
    user_metadata: { name: "Alok Yadav", avatar_url: "https://x/y.png" },
  });
  assert.equal(p.authId, "auth-123");
  assert.equal(p.email, "alok@example.com"); // normalised
  assert.equal(p.name, "Alok Yadav");
  assert.equal(p.avatarUrl, "https://x/y.png");
});

test("falls back to full_name, then to the email local-part", () => {
  const withFull = mapSupabaseUserToProfile({
    id: "a",
    email: "sam@example.com",
    user_metadata: { full_name: "Sam Smith" },
  });
  assert.equal(withFull.name, "Sam Smith");

  const noMeta = mapSupabaseUserToProfile({ id: "b", email: "priya@example.com" });
  assert.equal(noMeta.name, "priya");
  assert.equal(noMeta.avatarUrl, null);
});

test("handles a missing email without throwing", () => {
  const p = mapSupabaseUserToProfile({ id: "c" });
  assert.equal(p.email, "");
  assert.equal(p.name, "Member");
});
