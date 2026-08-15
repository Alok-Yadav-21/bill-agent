import { requireUser } from "@/lib/session";
import { ok, guarded } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { normaliseEmail } from "@/server/services/invitation-util";

export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const invites = await prisma.invitation.findMany({
      where: { email: normaliseEmail(user.email), status: "PENDING" },
      include: { household: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok(
      invites.map((i) => ({
        token: i.token,
        householdName: i.household.name,
        role: i.role,
        expiresAt: i.expiresAt,
      })),
    );
  });
}
