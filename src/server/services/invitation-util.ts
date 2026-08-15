import { randomBytes } from "node:crypto";

/** Pure, testable helpers for invitations. */

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A URL-safe random token used to redeem an invitation. */
export function makeInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

/** An invite is redeemable by a user only if the emails match (normalised). */
export function inviteMatchesUser(inviteEmail: string, userEmail: string): boolean {
  return normaliseEmail(inviteEmail) === normaliseEmail(userEmail);
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** Default invite lifetime: 14 days. */
export function defaultInviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
}
