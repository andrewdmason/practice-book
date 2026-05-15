"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayLocal } from "@/lib/journal/today";
import type { JournalAgentChatMessage, JournalAgentFileName } from "@/lib/types";

export async function getOrCreateTodayEntry(): Promise<{
  id: string;
  status: "open" | "closed";
  opening_question: string | null;
}> {
  const supabase = await createClient();
  const date = await todayLocal();

  // Most recent entry for today, regardless of status. Could be open (in
  // progress) or closed (finished — the page will show the "done" view).
  const { data: existing } = await supabase
    .from("journal_entries")
    .select("id, status, opening_question")
    .eq("entry_date", date)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      status: existing.status as "open" | "closed",
      opening_question: existing.opening_question,
    };
  }

  const { data: created, error } = await supabase
    .from("journal_entries")
    .insert({ entry_date: date, status: "open" })
    .select("id, status, opening_question")
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? "failed to create entry");
  }
  return {
    id: created.id,
    status: created.status as "open" | "closed",
    opening_question: created.opening_question,
  };
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
