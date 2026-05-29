import { createClient } from "@/lib/supabase/server";
import type {
  JournalAgentFile,
  JournalAgentFileName,
  JournalEntry,
  JournalMessage,
  JournalQuestionType,
  JournalSettings,
} from "@/lib/types";

export type AgentFiles = Record<JournalAgentFileName, string>;

export async function loadAgentFiles(): Promise<AgentFiles> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_agent_files")
    .select("name, content");
  if (error) throw error;

  const files: AgentFiles = { Interviewer: "", User: "" };
  for (const row of (data ?? []) as Pick<JournalAgentFile, "name" | "content">[]) {
    files[row.name] = row.content ?? "";
  }
  return files;
}

export async function loadQuestionTypes(): Promise<JournalQuestionType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_question_types")
    .select(
      "id, name, base_description, style_note, weight, enabled, is_builtin, sort_order, created_at, updated_at"
    )
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as JournalQuestionType[];
}

export async function loadSettings(): Promise<JournalSettings> {
  const supabase = await createClient();
  // One settings row per user — RLS scopes this to the caller's row, so no
  // explicit filter is needed (the old id=1 singleton column is gone).
  const { data, error } = await supabase
    .from("journal_settings")
    .select("questions_per_day")
    .maybeSingle();
  if (error) throw error;
  return { questions_per_day: data?.questions_per_day ?? 3 };
}

type RecentEntry = JournalEntry & { messages: JournalMessage[] };

/**
 * Load entries other than the current one, most recent first.
 * Full conversations for the most recent `fullEntries` entries; one-line
 * summaries for older. Earlier same-day threads count as recent.
 */
export async function loadHistory(
  today: string,
  excludeEntryId: string | null = null,
  fullEntries = 7
) {
  const supabase = await createClient();

  let query = supabase
    .from("journal_entries")
    .select(
      "id, entry_date, status, opening_question, opening_candidates, candidates_reroll_count, summary, title, pull_quote, summary_stale, closed_at, created_at, updated_at"
    )
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);
  if (excludeEntryId) {
    query = query.neq("id", excludeEntryId);
  } else {
    // No current entry — fall back to "everything before today" so we don't
    // accidentally pull in an in-progress entry from elsewhere.
    query = query.lt("entry_date", today);
  }

  const { data: entriesData, error } = await query;
  if (error) throw error;

  const entries = (entriesData ?? []) as JournalEntry[];
  const recentEntries = entries.slice(0, fullEntries);
  const olderEntries = entries.slice(fullEntries);

  let recent: RecentEntry[] = [];
  if (recentEntries.length > 0) {
    const ids = recentEntries.map((e) => e.id);
    const { data: msgs, error: msgErr } = await supabase
      .from("journal_messages")
      .select("id, entry_id, role, content, created_at")
      .in("entry_id", ids)
      .order("created_at", { ascending: true });
    if (msgErr) throw msgErr;

    const byEntry = new Map<string, JournalMessage[]>();
    for (const m of (msgs ?? []) as JournalMessage[]) {
      const arr = byEntry.get(m.entry_id) ?? [];
      arr.push(m);
      byEntry.set(m.entry_id, arr);
    }
    recent = recentEntries.map((e) => ({ ...e, messages: byEntry.get(e.id) ?? [] }));
  }

  return { recent, older: olderEntries };
}

/**
 * Assemble the system prompt for the interviewer turn (opening question or follow-up).
 */
export function buildSystemPrompt(
  files: AgentFiles,
  history: { recent: RecentEntry[]; older: JournalEntry[] },
  today: string,
  calendarBlock?: string | null,
  nowLabel?: string | null
): string {
  const sections: string[] = [];

  sections.push(
    "You are the journal interviewer for a single user. Two editable files describe you and the user; everything else is internal protocol."
  );
  sections.push(
    "Before responding, ground yourself in Interviewer (your voice and how you ask — not which topics to pick) and User (who you're talking to). Which kinds of questions to ask, and how often, is decided separately and handed to you below; the Interviewer file only governs voice and craft."
  );
  sections.push(
    "Never mention these files, your tools, or your reasoning to the user. The user only sees your message."
  );
  sections.push("");
  sections.push("=== Interviewer ===");
  sections.push(files.Interviewer || "(empty)");
  sections.push("");
  sections.push("=== User ===");
  sections.push(files.User || "(empty — the user hasn't filled this out yet)");
  sections.push("");

  if (calendarBlock && calendarBlock.trim().length > 0) {
    sections.push(calendarBlock);
    sections.push("");
  }

  if (history.recent.length > 0) {
    sections.push("=== Recent journal entries (full transcripts, most recent first) ===");
    for (const entry of history.recent) {
      sections.push(`--- ${entry.entry_date}${entry.summary ? ` — ${entry.summary}` : ""} ---`);
      for (const m of entry.messages) {
        sections.push(`${m.role === "assistant" ? "Interviewer" : "User"}: ${m.content}`);
      }
      sections.push("");
    }
  }

  if (history.older.length > 0) {
    sections.push("=== Older entries (one-line summaries) ===");
    for (const e of history.older) {
      sections.push(`${e.entry_date}: ${e.summary ?? "(no summary)"}`);
    }
    sections.push("");
  }

  if (nowLabel) {
    sections.push(
      `Right now it's ${nowLabel}. Use this to judge whether a calendar event has already happened or is still upcoming — an event later today has not happened yet.`
    );
  } else {
    sections.push(`Today's date: ${today}.`);
  }

  return sections.join("\n");
}

export function messagesAsAnthropicTurns(
  messages: Pick<JournalMessage, "role" | "content">[]
) {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}
