/** Pure mapping helpers for auth users. No I/O, so unit-testable in isolation. */

export interface SupabaseAuthUser {
  id: string;
  email?: string | null;
  user_metadata?: {
    name?: string;
    full_name?: string;
    avatar_url?: string;
  } | null;
}

export interface UserProfile {
  authId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export function mapSupabaseUserToProfile(u: SupabaseAuthUser): UserProfile {
  const email = (u.email ?? "").trim().toLowerCase();
  const metaName = u.user_metadata?.name || u.user_metadata?.full_name;
  const fallbackName = email ? email.split("@")[0] : "Member";
  return {
    authId: u.id,
    email,
    name: (metaName && metaName.trim()) || fallbackName,
    avatarUrl: u.user_metadata?.avatar_url ?? null,
  };
}
