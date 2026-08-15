import { fail } from "./api-response";
import { createSupabaseServerClient } from "./supabase/server";
import { getOrCreateUserFromAuth } from "@/server/services/user-service";

export interface SessionUser {
  id: string; // internal User.id (source of truth), NOT the Supabase auth id
  email: string;
  name: string;
}

/**
 * Resolves the authenticated user for the current request.
 *
 * Identity is derived from the verified Supabase session cookie (via
 * supabase.auth.getUser(), which validates the JWT server-side) — never from a
 * client-supplied id or header. The auth user is then mapped to our internal
 * User row so the rest of the app deals only in trusted internal ids.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUser = await getOrCreateUserFromAuth(user);
  return { id: dbUser.id, email: dbUser.email, name: dbUser.name };
}

/** Return the user, or a 401 Response the handler can return to short-circuit. */
export async function requireUser(): Promise<SessionUser | Response> {
  const user = await getSessionUser();
  if (!user) return fail("UNAUTHENTICATED", "You must be signed in.", 401);
  return user;
}
