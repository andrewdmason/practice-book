"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayLocal } from "@/lib/journal/today";
import { runWrap } from "@/lib/journal/wrap";
import type {
  JournalAgentChatMessage,
  JournalAgentFileName,
  JournalMediaType,
} from "@/lib/types";

/** The zen timer's five-minute minimum — kept in sync with timer-context.tsx. */
const TIMER_DURATION_MS = 5 * 60 * 1000;

/**
 * Whether an open entry's writing session is effectively over: its five-minute
 * timer has elapsed. The timer anchors to when "write freely" was clicked
 * (`freeform_started_at`) or, for a picked question, to the opening message's
 * timestamp. An entry that was never started has no anchor and is not done.
 */
async function entrySessionDone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: { id: string; freeform_started_at: string | null }
): Promise<boolean> {
  let anchor = entry.freeform_started_at;
  if (!anchor) {
    const { data: firstMsg } = await supabase
      .from("journal_messages")
      .select("created_at")
      .eq("entry_id", entry.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    anchor = firstMsg?.created_at ?? null;
  }
  if (!anchor) return false;
  return Date.now() - new Date(anchor).getTime() >= TIMER_DURATION_MS;
}

export async function getOrCreateTodayEntry(): Promise<{
  id: string;
  status: "open" | "closed";
  opening_question: string | null;
  opening_candidates: string[] | null;
  candidates_reroll_count: number;
  freeform_started_at: string | null;
}> {
  const supabase = await createClient();
  const date = await todayLocal();
  const columns =
    "id, status, opening_question, opening_candidates, candidates_reroll_count, freeform_started_at";

  // Most recent *open* entry for today. /journal/new resumes an in-progress
  // thread, but only while its writing session is still live: a finished
  // entry whose timer has elapsed (but which was never formally closed)
  // should not be resumed — "+ new entry" creates a fresh one instead.
  const { data: existing } = await supabase
    .from("journal_entries")
    .select(columns)
    .eq("entry_date", date)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && !(await entrySessionDone(supabase, existing))) {
    return {
      id: existing.id,
      status: existing.status as "open" | "closed",
      opening_question: existing.opening_question,
      opening_candidates: existing.opening_candidates as string[] | null,
      candidates_reroll_count: existing.candidates_reroll_count,
      freeform_started_at: existing.freeform_started_at,
    };
  }

  const { data: created, error } = await supabase
    .from("journal_entries")
    .insert({ entry_date: date, status: "open" })
    .select(columns)
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? "failed to create entry");
  }
  return {
    id: created.id,
    status: created.status as "open" | "closed",
    opening_question: created.opening_question,
    opening_candidates: created.opening_candidates as string[] | null,
    candidates_reroll_count: created.candidates_reroll_count,
    freeform_started_at: created.freeform_started_at,
  };
}

/**
 * Load a single entry for the /journal/new editor. Used when the editor is
 * opened for a specific entry (e.g. one started from a dropped photo whose
 * date was moved into the past, so it no longer matches "today's entry").
 */
export async function getEntryById(entryId: string): Promise<{
  id: string;
  status: "open" | "closed";
  opening_question: string | null;
  opening_candidates: string[] | null;
  candidates_reroll_count: number;
  freeform_started_at: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select(
      "id, status, opening_question, opening_candidates, candidates_reroll_count, freeform_started_at"
    )
    .eq("id", entryId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "entry not found");
  return {
    id: data.id,
    status: data.status as "open" | "closed",
    opening_question: data.opening_question,
    opening_candidates: data.opening_candidates as string[] | null,
    candidates_reroll_count: data.candidates_reroll_count,
    freeform_started_at: data.freeform_started_at,
  };
}

/**
 * Create a fresh entry that starts straight in freeform mode, skipping the
 * opening-question picker. Used when a new entry is initiated by dropping
 * photos onto the journal list. Returns the new entry id.
 */
export async function createFreeformEntry(): Promise<string> {
  const supabase = await createClient();
  const date = await todayLocal();
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      entry_date: date,
      status: "open",
      freeform_started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "failed to create entry");
  }
  return data.id as string;
}

/**
 * Set an entry's date. Used when a new entry is started from a dropped photo
 * and the user opts to date the entry to when the photo was taken.
 */
export async function setEntryDate(entryId: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("invalid date");
  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_entries")
    .update({ entry_date: date })
    .eq("id", entryId);
  if (error) throw new Error(error.message);
  revalidatePath("/journal");
}

/**
 * Skip the opening-question picker and start a freeform entry. Records the
 * moment "write freely" was clicked: this both flags the entry as freeform
 * (bypassing the picker) and anchors the five-minute timer.
 */
export async function startFreeformEntry(entryId: string) {
  const supabase = await createClient();

  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .select("id, status, opening_candidates")
    .eq("id", entryId)
    .single();
  if (entryErr || !entry) throw new Error("entry not found");
  if (entry.status !== "open") throw new Error("entry is closed");

  const { count, error: countErr } = await supabase
    .from("journal_messages")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entryId);
  if (countErr) throw new Error(countErr.message);
  if ((count ?? 0) > 0) throw new Error("entry already started");

  const { error: updateErr } = await supabase
    .from("journal_entries")
    .update({
      freeform_started_at: new Date().toISOString(),
      opening_candidates: null,
    })
    .eq("id", entryId);
  if (updateErr) throw new Error(updateErr.message);

  // Choosing freeform skips every shown candidate — persist them so future
  // days don't resurface the same prompts.
  const shown = (entry.opening_candidates as string[] | null) ?? [];
  if (shown.length > 0) {
    const today = await todayLocal();
    await supabase.from("journal_skipped_questions").insert(
      shown.map((q) => ({ question: q, entry_id: entryId, skipped_on: today }))
    );
  }

  revalidatePath("/journal/new");
}

/**
 * Pick one of the three opening-question candidates. Inserts it as the opening
 * assistant message so the entry transitions from the picker to the chat.
 */
export async function pickOpeningQuestion(entryId: string, question: string) {
  const supabase = await createClient();

  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .select("id, status, opening_candidates")
    .eq("id", entryId)
    .single();
  if (entryErr || !entry) throw new Error("entry not found");
  if (entry.status !== "open") throw new Error("entry is closed");

  const candidates = (entry.opening_candidates as string[] | null) ?? [];
  if (!candidates.includes(question)) {
    throw new Error("question is not one of the offered candidates");
  }

  const { count, error: countErr } = await supabase
    .from("journal_messages")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entryId);
  if (countErr) throw new Error(countErr.message);
  if ((count ?? 0) > 0) throw new Error("entry already started");

  const { error: msgErr } = await supabase
    .from("journal_messages")
    .insert({ entry_id: entryId, role: "assistant", content: question });
  if (msgErr) throw new Error(msgErr.message);

  const { error: updateErr } = await supabase
    .from("journal_entries")
    .update({ opening_question: question, opening_candidates: null })
    .eq("id", entryId);
  if (updateErr) throw new Error(updateErr.message);

  // The other candidates in the final set were shown but not chosen — persist
  // them so future days don't resurface the same prompts.
  const notPicked = candidates.filter((q) => q !== question);
  if (notPicked.length > 0) {
    const today = await todayLocal();
    await supabase.from("journal_skipped_questions").insert(
      notPicked.map((q) => ({ question: q, entry_id: entryId, skipped_on: today }))
    );
  }

  revalidatePath("/journal/new");
}

/**
 * Append a user message to an entry without generating an interviewer reply.
 * Used once the five-minute timer is done: the user can keep writing, but the
 * conversation is over — the agent is no longer asked to respond.
 */
export async function appendUserMessage(entryId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const supabase = await createClient();

  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .select("id, status")
    .eq("id", entryId)
    .single();
  if (entryErr || !entry) throw new Error("entry not found");
  if (entry.status !== "open") throw new Error("entry is closed");

  const { error } = await supabase
    .from("journal_messages")
    .insert({ entry_id: entryId, role: "user", content: trimmed });
  if (error) throw new Error(error.message);
}

/**
 * Delete the most recent message of an open entry when it's an unanswered
 * interviewer question. Covers the case where a question was asked but the
 * timer ran out (or the user simply doesn't want it) before replying.
 */
export async function deleteLatestQuestion(entryId: string) {
  const supabase = await createClient();

  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .select("id, status")
    .eq("id", entryId)
    .single();
  if (entryErr || !entry) throw new Error("entry not found");
  if (entry.status !== "open") throw new Error("entry is closed");

  const { data: last, error: lastErr } = await supabase
    .from("journal_messages")
    .select("id, role")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) throw new Error(lastErr.message);
  if (!last || last.role !== "assistant") {
    throw new Error("no question to delete");
  }

  const { error } = await supabase
    .from("journal_messages")
    .delete()
    .eq("id", last.id);
  if (error) throw new Error(error.message);

  revalidatePath("/journal");
}

/**
 * Mark an entry closed. The wrap pass (summary/title/pull_quote) is generated
 * separately via /journal/api/close — flipping status here first means the
 * journal list can immediately show the entry in its "generating" state.
 */
export async function closeEntry(entryId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_entries")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", entryId)
    .eq("status", "open");
  if (error) throw new Error(error.message);
  revalidatePath("/journal");
}

/**
 * Re-run the wrap pass (summary/title/pull_quote) for a closed entry. Used to
 * recover entries whose original fire-and-forget wrap never landed — e.g. the
 * close request failed silently or the Claude call errored.
 */
export async function regenerateEntryWrap(entryId: string): Promise<void> {
  const result = await runWrap(entryId);
  if (!result.ok) throw new Error(result.error);
  revalidatePath("/journal");
  revalidatePath(`/journal/${entryId}`);
}

export async function reopenEntry(entryId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_entries")
    .update({ status: "open", summary_stale: true, closed_at: null })
    .eq("id", entryId);
  if (error) throw new Error(error.message);
  revalidatePath("/journal", "layout");
}

export async function deleteEntry(entryId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", entryId);
  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  redirect("/journal");
}

export async function saveAgentFile(
  name: JournalAgentFileName,
  content: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_agent_files")
    .update({ content })
    .eq("name", name);
  if (error) throw new Error(error.message);
  revalidatePath("/journal/agent");
}

export async function loadAgentChatMessages(): Promise<JournalAgentChatMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_agent_chat_messages")
    .select("id, role, content, source_entry_id, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as JournalAgentChatMessage[];
}

export async function latestAgentChatAt(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_agent_chat_messages")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.created_at ?? null;
}

// ============================================================
// Entry photos
// ============================================================

const PHOTOS_BUCKET = "journal-photos";

export async function createPhotoUploadUrls(
  entryId: string,
  photoId: string,
  ext: string
): Promise<{
  originalPath: string;
  originalToken: string;
  displayPath: string;
  displayToken: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const originalPath = `${user.id}/${entryId}/${photoId}-original.${safeExt}`;
  const displayPath = `${user.id}/${entryId}/${photoId}-display.jpg`;

  const original = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUploadUrl(originalPath);
  if (original.error || !original.data) {
    throw new Error(
      original.error?.message ?? "Failed to create upload URL"
    );
  }
  const display = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUploadUrl(displayPath);
  if (display.error || !display.data) {
    throw new Error(display.error?.message ?? "Failed to create upload URL");
  }

  return {
    originalPath: original.data.path,
    originalToken: original.data.token,
    displayPath: display.data.path,
    displayToken: display.data.token,
  };
}

export async function attachEntryPhoto(
  entryId: string,
  originalPath: string,
  displayPath: string,
  mediaType: "photo" | "video" = "photo"
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entry_photos")
    .insert({
      entry_id: entryId,
      original_path: originalPath,
      display_path: displayPath,
      media_type: mediaType,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to attach photo");
  revalidatePath("/journal");
  revalidatePath(`/journal/${entryId}`);
  return data.id as string;
}

export async function deleteEntryPhoto(photoId: string): Promise<void> {
  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("journal_entry_photos")
    .select("entry_id, original_path, display_path")
    .eq("id", photoId)
    .single();

  if (photo) {
    const paths = [photo.original_path, photo.display_path].filter(
      (p): p is string => Boolean(p)
    );
    if (paths.length > 0) {
      await supabase.storage.from(PHOTOS_BUCKET).remove(paths);
    }
  }

  const { error } = await supabase
    .from("journal_entry_photos")
    .delete()
    .eq("id", photoId);
  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  if (photo?.entry_id) revalidatePath(`/journal/${photo.entry_id}`);
}

export async function updatePhotoCaption(
  photoId: string,
  caption: string
): Promise<void> {
  const trimmed = caption.trim();
  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("journal_entry_photos")
    .update({ caption: trimmed || null })
    .eq("id", photoId)
    .select("entry_id")
    .single();
  revalidatePath("/journal");
  if (photo?.entry_id) revalidatePath(`/journal/${photo.entry_id}`);
}

export async function createSignedPhotoUrl(
  displayPath: string
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrl(displayPath, 60 * 60);
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create signed photo URL");
  }
  return data.signedUrl;
}

export async function getEntriesPhotos(
  entryIds: string[]
): Promise<
  Record<string, { id: string; displayUrl: string; mediaType: JournalMediaType }[]>
> {
  if (entryIds.length === 0) return {};
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("journal_entry_photos")
    .select("id, entry_id, display_path, media_type")
    .in("entry_id", entryIds)
    .order("created_at", { ascending: true });

  if (!rows || rows.length === 0) return {};

  const { data: signed } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.display_path as string),
      60 * 60
    );

  const result: Record<
    string,
    { id: string; displayUrl: string; mediaType: JournalMediaType }[]
  > = {};
  rows.forEach((row, i) => {
    const entryId = row.entry_id as string;
    (result[entryId] ??= []).push({
      id: row.id as string,
      displayUrl: signed?.[i]?.signedUrl ?? "",
      mediaType: (row.media_type as JournalMediaType) ?? "photo",
    });
  });
  return result;
}

export async function getEntryPhotos(entryId: string): Promise<
  {
    id: string;
    mediaType: JournalMediaType;
    displayUrl: string;
    videoUrl: string | null;
    caption: string | null;
  }[]
> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("journal_entry_photos")
    .select("id, media_type, original_path, display_path, caption")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true });

  if (!rows || rows.length === 0) return [];

  const { data: signedDisplay } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.display_path as string),
      60 * 60
    );

  // Videos also need a signed URL for the original file so the lightbox can
  // play it; photos never use the original at display time.
  const videoRows = rows.filter((r) => r.media_type === "video");
  const { data: signedVideo } = videoRows.length
    ? await supabase.storage
        .from(PHOTOS_BUCKET)
        .createSignedUrls(
          videoRows.map((r) => r.original_path as string),
          60 * 60
        )
    : { data: null };
  const videoUrlByPath = new Map<string, string>();
  videoRows.forEach((row, i) => {
    const url = signedVideo?.[i]?.signedUrl;
    if (url) videoUrlByPath.set(row.original_path as string, url);
  });

  return rows.map((row, i) => ({
    id: row.id as string,
    mediaType: (row.media_type as JournalMediaType) ?? "photo",
    displayUrl: signedDisplay?.[i]?.signedUrl ?? "",
    videoUrl:
      row.media_type === "video"
        ? videoUrlByPath.get(row.original_path as string) ?? null
        : null,
    caption: (row.caption as string | null) ?? null,
  }));
}
