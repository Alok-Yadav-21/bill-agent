import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { createInvitationSchema } from "@/lib/validation";
import { requireAdmin, requireMembership, ForbiddenError } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  normaliseEmail,
  makeInviteToken,
  defaultInviteExpiry,
} from "@/server/services/invitation-util";

export async function POST(req: Request) {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");

    try {
      await requireAdmin(user.id, householdId); // only admins invite
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      throw err;
    }

    const body = await req.json().catch(() => null);
    const parsed = createInvitationSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input", 422);

    const email = normaliseEmail(parsed.data.email);

    // If that email is already an active member, no invite needed.
    const already = await prisma.householdMember.findFirst({
      where: { householdId, user: { email }, status: "ACTIVE" },
    });
    if (already) return fail("ALREADY_MEMBER", "That person is already a member.", 409);

    // Reuse an existing pending invite for the same email, else create one.
    const existing = await prisma.invitation.findFirst({
      where: { householdId, email, status: "PENDING" },
    });

    const invite =
      existing ??
      (await prisma.invitation.create({
        data: {
          householdId,
          email,
          role: parsed.data.role,
          token: makeInviteToken(),
          invitedBy: user.id,
          expiresAt: defaultInviteExpiry(),
        },
      }));

    if (!existing) {
      await prisma.auditLog.create({
        data: {
          householdId, userId: user.id, action: "invitation.create",
          entityType: "Invitation", entityId: invite.id, metadata: { email },
        },
      });
    }

    // We don't send email locally; return the shareable link so the admin can
    // pass it on. (Swap in an email provider later without changing callers.)
    return ok(
      {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        token: invite.token,
        acceptPath: `/onboarding?token=${invite.token}`,
        expiresAt: invite.expiresAt,
      },
      201,
    );
  });
}

export async function GET(req: Request) {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");
    try {
      await requireMembership(user.id, householdId);
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      throw err;
    }
    const invites = await prisma.invitation.findMany({
      where: { householdId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
    });
    return ok(invites);
  });
}
