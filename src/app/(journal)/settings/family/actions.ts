"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/journal/auth";
import type { JournalMember } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Save the shared family-context doc. Owner-only (writes bypass RLS via the
 * service role; reads are open to all members). */
export async function saveFamilyDoc(content: string): Promise<void> {
  await requireOwner();
  const admin = createAdminClient();
  const { error } = await admin
    .from("journal_family")
    .update({ content })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/family");
}

/** List all family members. Owner-only (uses service role to see every row,
 * since RLS otherwise scopes reads to the caller's own membership). */
export async function listFamilyMembers(): Promise<JournalMember[]> {
  await requireOwner();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("journal_members")
    .select("email, name, is_owner, user_id, seeded_at")
    .order("is_owner", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as JournalMember[];
}

/** Add a family member to the allowlist. They're provisioned on first sign-in. */
export async function addFamilyMember(emailRaw: string, nameRaw: string): Promise<void> {
  await requireOwner();
  const email = emailRaw.trim().toLowerCase();
  const name = nameRaw.trim();
  if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
  if (!name) throw new Error("Give this person a name.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("journal_members")
    .insert({ email, name, is_owner: false });
  if (error) {
    if (error.code === "23505") throw new Error(`${email} is already a member.`);
    throw new Error(error.message);
  }
  revalidatePath("/settings/family");
}

/** Remove a family member: revokes allowlist access and deletes their account
 * and all of their journal data (auth.users delete cascades). The owner cannot
 * remove themselves. */
export async function removeFamilyMember(emailRaw: string): Promise<void> {
  const ownerId = await requireOwner();
  const email = emailRaw.trim().toLowerCase();

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("journal_members")
    .select("email, user_id, is_owner")
    .eq("email", email)
    .maybeSingle();
  if (!member) throw new Error("Member not found.");
  if (member.is_owner || member.user_id === ownerId) {
    throw new Error("You can't remove the owner account.");
  }

  // Deleting the auth user cascades all their journal_* rows. The membership
  // row's user_id FK is ON DELETE SET NULL, so remove it explicitly too.
  if (member.user_id) {
    const { error: delErr } = await admin.auth.admin.deleteUser(member.user_id);
    if (delErr) throw new Error(delErr.message);
  }
  const { error } = await admin.from("journal_members").delete().eq("email", email);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/family");
}
