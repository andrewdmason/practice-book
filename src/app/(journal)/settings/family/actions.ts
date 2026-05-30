"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/journal/auth";
import type { JournalMember, MemberPhoto } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMBER_PHOTOS_BUCKET = "member-photos";

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

  // Remove their profile-photo files before the membership row (and its
  // journal_member_photos rows, via ON DELETE CASCADE) goes away.
  const { data: photos } = await admin
    .from("journal_member_photos")
    .select("storage_path")
    .eq("member_email", email);
  const photoPaths = (photos ?? []).map((p) => p.storage_path as string);
  if (photoPaths.length > 0) {
    await admin.storage.from(MEMBER_PHOTOS_BUCKET).remove(photoPaths);
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

// ============================================================
// Member profile photos
// ============================================================

/** All members' profile photos, keyed by member email, primary-first within
 * each member. Owner-only; signs short-lived display URLs via the service role. */
export async function getMemberPhotos(): Promise<Record<string, MemberPhoto[]>> {
  await requireOwner();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("journal_member_photos")
    .select("id, member_email, storage_path, is_primary, created_at")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return {};

  const { data: signed } = await admin.storage
    .from(MEMBER_PHOTOS_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path as string),
      60 * 60
    );

  const result: Record<string, MemberPhoto[]> = {};
  rows.forEach((row, i) => {
    const email = row.member_email as string;
    (result[email] ??= []).push({
      id: row.id as string,
      url: signed?.[i]?.signedUrl ?? "",
      is_primary: row.is_primary === true,
    });
  });
  return result;
}

/** Upload one profile photo for a member. The first photo a member gets becomes
 * their primary automatically. Owner-only. */
export async function addMemberPhoto(formData: FormData): Promise<void> {
  await requireOwner();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const file = formData.get("file");
  if (!EMAIL_RE.test(email)) throw new Error("Unknown member.");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Pick an image to upload.");
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("journal_members")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (!member) throw new Error("Member not found.");

  const { count } = await admin
    .from("journal_member_photos")
    .select("id", { count: "exact", head: true })
    .eq("member_email", email);
  const isFirst = (count ?? 0) === 0;

  const photoId = crypto.randomUUID();
  const path = `${email}/${photoId}.jpg`;
  const { error: upErr } = await admin.storage
    .from(MEMBER_PHOTOS_BUCKET)
    .upload(path, file, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw new Error(upErr.message);

  const { error } = await admin.from("journal_member_photos").insert({
    member_email: email,
    storage_path: path,
    is_primary: isFirst,
  });
  if (error) {
    await admin.storage.from(MEMBER_PHOTOS_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  revalidatePath("/settings/family");
}

/** Make one of a member's photos their primary, clearing the previous primary. */
export async function setPrimaryMemberPhoto(photoId: string): Promise<void> {
  await requireOwner();
  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("journal_member_photos")
    .select("id, member_email")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) throw new Error("Photo not found.");

  // Clear the existing primary first so the partial unique index never trips.
  const { error: clearErr } = await admin
    .from("journal_member_photos")
    .update({ is_primary: false })
    .eq("member_email", photo.member_email)
    .eq("is_primary", true);
  if (clearErr) throw new Error(clearErr.message);

  const { error } = await admin
    .from("journal_member_photos")
    .update({ is_primary: true })
    .eq("id", photoId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/family");
}

/** Delete one of a member's photos. If it was the primary and others remain,
 * promote the newest remaining photo to primary. Owner-only. */
export async function deleteMemberPhoto(photoId: string): Promise<void> {
  await requireOwner();
  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("journal_member_photos")
    .select("id, member_email, storage_path, is_primary")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) throw new Error("Photo not found.");

  await admin.storage.from(MEMBER_PHOTOS_BUCKET).remove([photo.storage_path as string]);
  const { error } = await admin
    .from("journal_member_photos")
    .delete()
    .eq("id", photoId);
  if (error) throw new Error(error.message);

  if (photo.is_primary) {
    const { data: next } = await admin
      .from("journal_member_photos")
      .select("id")
      .eq("member_email", photo.member_email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (next) {
      await admin
        .from("journal_member_photos")
        .update({ is_primary: true })
        .eq("id", next.id);
    }
  }
  revalidatePath("/settings/family");
}
