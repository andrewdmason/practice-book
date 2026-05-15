import { ChatSurface } from "@/components/journal/chat-surface";
import { JournalEntryScope } from "@/components/journal/journal-entry-scope";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateTodayEntry } from "@/app/(journal)/journal/actions";
import type { JournalMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const entry = await getOrCreateTodayEntry();

  const supabase = await createClient();
  const { data: msgs } = await supabase
    .from("journal_messages")
    .select("id, entry_id, role, content, created_at")
    .eq("entry_id", entry.id)
    .order("created_at", { ascending: true });

  const messages = ((msgs ?? []) as JournalMessage[]).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Fetch summary if entry is closed
  let summary: string | null = null;
  if (entry.status === "closed") {
    const { data: full } = await supabase
      .from("journal_entries")
      .select("summary")
      .eq("id", entry.id)
      .single();
    summary = full?.summary ?? null;
  }

  return (
    <>
      <JournalEntryScope id={entry.id} />
      <ChatSurface
        entryId={entry.id}
        initialStatus={entry.status}
        initialMessages={messages}
        initialSummary={summary}
      />
    </>
  );
}
