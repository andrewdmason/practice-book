import { ChatSurface } from "@/components/journal/chat-surface";
import { OpeningPicker } from "@/components/journal/opening-picker";
import { JournalEntryScope } from "@/components/journal/journal-entry-scope";
import { JournalPhotoGallery } from "@/components/journal/journal-photo-gallery";
import { createClient } from "@/lib/supabase/server";
import {
  getEntryById,
  getEntryPhotos,
  getOrCreateTodayEntry,
} from "@/app/(journal)/journal/actions";
import type { JournalMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ entry?: string }>;
}) {
  const { entry: entryParam } = await searchParams;
  const entry = entryParam
    ? await getEntryById(entryParam)
    : await getOrCreateTodayEntry();

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

  // The zen timer is anchored to a wall-clock timestamp so its completion
  // persists across refreshes and reopens. A freeform entry has no opening
  // message, so it anchors to when "write freely" was clicked; a picked
  // question anchors to the opening question's timestamp.
  const timerStartedAt =
    entry.freeform_started_at ?? messageRows[0]?.created_at ?? null;

  const photos = await getEntryPhotos(entry.id);

  // A fresh open entry with no messages starts in the three-question picker;
  // picking one inserts the opening message and hands off to the chat. Once
  // "write freely" is clicked the picker is bypassed straight to the chat.
  const showPicker = messages.length === 0 && !entry.freeform_started_at;

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
          timerStartedAt={timerStartedAt}
        />
      )}
    </>
  );
}
