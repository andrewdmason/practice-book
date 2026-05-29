import { createClient } from "@/lib/supabase/server";

/**
 * Resolve the authenticated user's id, throwing if there's no session.
 *
 * Journal rows are scoped per-user by RLS, whose WITH CHECK clause rejects any
 * insert that omits user_id — so every journal insert must stamp it. Reads don't
 * need an explicit user filter (RLS applies one automatically).
 */
export async function requireUserId(
  supabase?: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}
