import { requireUser } from "@/lib/session";
import { ok, fail, guarded } from "@/lib/api-response";
import { acceptInvitationSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { inviteMatchesUser, isExpired } from "@/server/services/invitation-util";

export async function POST(req: Request) {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;

    const body = await req.json().catch(() => null);
    const parsed = acceptInvitationSchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", "Invalid token", 422);

    const invite = await prisma.invitation.findUnique({ where: { token: parsed.data.token } });
    if (!invite || invite.status !== "PENDING") {
      return fail("INVALID_INVITE", "This invitation is no longer valid.", 410);
    }
    if (isExpired(invite.expiresAt)) {
      await prisma.invitation.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
      return fail("EXPIRED", "This invitation has expired.", 410);
    }
    // The invite is bound to an email; only that person may accept it.
    if (!inviteMatchesUser(invite.email, user.email)) {
      return fail("EMAIL_MISMATCH", "This invitation was sent to a different email address.", 403);
    }

    await prisma.$transaction(async (tx) => {
      await tx.householdMember.upsert({
        where: { householdId_userId: { householdId: invite.householdId, userId: user.id } },
        update: { status: "ACTIVE", role: invite.role },
        create: { householdId: invite.householdId, userId: user.id, role: invite.role, status: "ACTIVE" },
      });
      await tx.invitation.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          householdId: invite.householdId, userId: user.id, action: "invitation.accept",
          entityType: "Invitation", entityId: invite.id, metadata: {},
        },
      });
    });

    return ok({ householdId: invite.householdId });
  });
}
