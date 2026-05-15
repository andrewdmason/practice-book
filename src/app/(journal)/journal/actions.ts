"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayLocal } from "@/lib/journal/today";
import type { JournalAgentChatMessage, JournalAgentFileName } from "@/lib/types";

export async function getOrCreateTodayEntry(): Promise<{
  id: string;
  status: "open" | "closed";
  opening_question: string | null;
  opening_candidates: string[] | null;
  candidates_reroll_count: number;
}> {
  const supabase = await createClient();
  const date = await todayLocal();
  const columns =
    "id, status, opening_question, opening_candidates, candidates_reroll_count";

  // Most recent entry for today, regardless of status. Could be open (in
  // progress) or closed (finished — the page will show the "done" view).
  const { data: existing } = await supabase
    .from("journal_entries")
    .select(columns)
    .eq("entry_date", date)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      status: existing.status as "open" | "closed",
      opening_question: existing.opening_question,
      opening_candidates: existing.opening_candidates as string[] | null,
      candidates_reroll_count: existing.candidates_reroll_count,
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
  };
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

  revalidatePath("/journal");
}

export async function startNewThread(): Promise<void> {
  const supabase = await createClient();
  const date = await todayLocal();
  const { error } = await supabase
    .from("journal_entries")
    .insert({ entry_date: date, status: "open" });
  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  revalidatePath("/journal/history");
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

export async function updateSummary(entryId: string, summary: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_entries")
    .update({ summary: summary.trim() })
    .eq("id", entryId);
  if (error) throw new Error(error.message);
  revalidatePath("/journal/history");
  revalidatePath(`/journal/history/${entryId}`);
}
