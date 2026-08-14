/** Extract householdId from the query string; callers verify membership. */
export function householdIdFrom(req: Request): string | null {
  const url = new URL(req.url);
  return url.searchParams.get("householdId");
}
