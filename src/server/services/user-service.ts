import { prisma } from "@/lib/db";
import { mapSupabaseUserToProfile, type SupabaseAuthUser } from "./user-mapper";

export type { SupabaseAuthUser, UserProfile } from "./user-mapper";
export { mapSupabaseUserToProfile } from "./user-mapper";

/**
 * Returns the internal User for a verified Supabase auth user, creating the row
 * on first sign-in. PostgreSQL stays the source of truth: expenses, memberships
 * etc. reference User.id, not the auth id.
 */
export async function getOrCreateUserFromAuth(authUser: SupabaseAuthUser) {
  const profile = mapSupabaseUserToProfile(authUser);

  const existing = await prisma.user.findUnique({ where: { authId: profile.authId } });
  if (existing) return existing;

  // A dev-seeded user may already exist by email with no authId — link it.
  const byEmail = profile.email
    ? await prisma.user.findUnique({ where: { email: profile.email } })
    : null;
  if (byEmail && !byEmail.authId) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { authId: profile.authId, avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl },
    });
  }

  return prisma.user.create({
    data: {
      authId: profile.authId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    },
  });
}
