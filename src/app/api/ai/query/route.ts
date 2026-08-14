import { requireUser } from "@/lib/session";
import { householdIdFrom } from "@/lib/request";
import { ok, fail, guarded } from "@/lib/api-response";
import { aiQuerySchema } from "@/lib/validation";
import { requireMembership, ForbiddenError } from "@/lib/authz";
import { getAiAssistant } from "@/server/services/ai";

export async function POST(req: Request) {
  return guarded(async () => {
    const user = await requireUser(req);
    if (user instanceof Response) return user;
    const householdId = householdIdFrom(req);
    if (!householdId) return fail("BAD_REQUEST", "householdId is required");

    // Authorization is enforced here, at the backend — not by the AI.
    try {
      await requireMembership(user.id, householdId);
    } catch (err) {
      if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403);
      throw err;
    }

    const body = await req.json().catch(() => null);
    const parsed = aiQuerySchema.safeParse(body);
    if (!parsed.success) return fail("VALIDATION", "Invalid query", 422);

    const assistant = getAiAssistant();
    const result = await assistant.query({ householdId, userId: user.id }, parsed.data.message);
    return ok(result);
  });
}
