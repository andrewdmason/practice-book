import { ChatSurface } from "@/components/journal/chat-surface";
import { OpeningPicker } from "@/components/journal/opening-picker";
import { JournalEntryScope } from "@/components/journal/journal-entry-scope";
import { JournalPhotoGallery } from "@/components/journal/journal-photo-gallery";
import { createClient } from "@/lib/supabase/server";
import {
  getEntryPhotos,
  getOrCreateTodayEntry,
} from "@/app/(journal)/journal/actions";
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

  const messageRows = (msgs ?? []) as JournalMessage[];
  const messages = messageRows.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // The zen timer is anchored to the opening question's timestamp so its
  // completion persists across refreshes and reopens.
  const timerStartedAt = messageRows[0]?.created_at ?? null;

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

  const photos = await getEntryPhotos(entry.id);

  // A fresh open entry with no messages starts in the three-question picker;
  // picking one inserts the opening message and hands off to the chat.
  const showPicker = entry.status === "open" && messages.length === 0;

  return (
    <>
      <JournalEntryScope id={entry.id} />
      <JournalPhotoGallery entryId={entry.id} initialPhotos={photos} editable />
      {showPicker ? (
        <OpeningPicker
          entryId={entry.id}
          initialCandidates={entry.opening_candidates}
          initialRerollCount={entry.candidates_reroll_count}
        />
      ) : (
        <ChatSurface
          entryId={entry.id}
          initialStatus={entry.status}
          initialMessages={messages}
          initialSummary={summary}
          timerStartedAt={timerStartedAt}
        />
      )}
    </>
  );
}
