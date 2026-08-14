import { fail } from "./api-response";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Resolves the authenticated user for a request.
 *
 * AUTH INTEGRATION POINT: wire this to your provider (Supabase Auth, Auth.js,
 * Clerk, etc.). It must derive identity from a verified, server-side session or
 * JWT — NEVER from a client-supplied user id or header. The rest of the app
 * treats the returned id as trusted precisely because this function verified it.
 */
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  // TODO: replace with real verification, e.g. Supabase:
  //   const { data } = await supabaseServer(req).auth.getUser();
  //   return data.user ? { id: data.user.id, email: ..., name: ... } : null;
  void req;
  return null;
}

/** Convenience: return the user or a 401 Response to short-circuit a handler. */
export async function requireUser(
  req: Request,
): Promise<SessionUser | Response> {
  const user = await getSessionUser(req);
  if (!user) return fail("UNAUTHENTICATED", "You must be signed in.", 401);
  return user;
}
