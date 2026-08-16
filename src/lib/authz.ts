import { prisma } from "./db";

/**
 * Server-side authorization. This is the real security boundary. The client's
 * claimed userId/householdId/role are NEVER trusted; membership and role are
 * verified against the database on every request.
 */
export type MemberRole = "ADMIN" | "MEMBER";

export interface Membership {
  householdId: string;
  userId: string;
  role: MemberRole;
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Assert the user is an ACTIVE member of the household; return their role. */
export async function requireMembership(
  userId: string,
  householdId: string,
): Promise<Membership> {
  const m = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId, userId } },
  });
  if (!m || m.status !== "ACTIVE") {
    throw new ForbiddenError();
  }
  return { householdId, userId, role: m.role };
}

export async function requireAdmin(
  userId: string,
  householdId: string,
): Promise<Membership> {
  const m = await requireMembership(userId, householdId);
  if (m.role !== "ADMIN") {
    throw new ForbiddenError("This action requires an admin.");
  }
  return m;
}

// --- Capability-based authorization (backend enforcement) ---
import { can as roleCan, type Role, type Capability } from "./permissions";

/** Assert the member has a capability; returns their membership for reuse. */
export async function requireCapability(
  userId: string,
  householdId: string,
  capability: Capability,
): Promise<Membership> {
  const m = await requireMembership(userId, householdId);
  if (!roleCan(m.role as Role, capability)) {
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return m;
}
