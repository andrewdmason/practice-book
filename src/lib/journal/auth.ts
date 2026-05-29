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

/**
 * Resolve whether the current user is the owner (the practice-book + family
 * admin). Reads the caller's own membership row (RLS-scoped).
 */
export async function getIsOwner(
  supabase?: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const client = supabase ?? (await createClient());
  const userId = await requireUserId(client);
  const { data } = await client
    .from("journal_members")
    .select("is_owner")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.is_owner === true;
}

/** Throw unless the current user is the owner. Returns the owner's user id. */
export async function requireOwner(
  supabase?: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const client = supabase ?? (await createClient());
  const userId = await requireUserId(client);
  if (!(await getIsOwner(client))) throw new Error("Not authorized");
  return userId;
}
