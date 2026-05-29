import { notFound } from "next/navigation";
import Link from "next/link";
import { ChatSurface } from "@/components/journal/chat-surface";
import { EntryTitle } from "@/components/journal/entry-title";
import { QuoteEntryView } from "@/components/journal/quote-entry-view";
import { JournalPhotoGallery } from "@/components/journal/journal-photo-gallery";
import { createClient } from "@/lib/supabase/server";
import { getEntryPhotos } from "@/app/(journal)/journal/actions";
import type { JournalEntry, JournalMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: entryRow } = await supabase
    .from("journal_entries")
    .select(
      "id, entry_date, status, entry_type, opening_question, summary, title, pull_quote, quote_attribution, summary_stale, closed_at, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!entryRow) notFound();
  const entry = entryRow as JournalEntry;

  const { data: msgs } = await supabase
    .from("journal_messages")
    .select("id, entry_id, role, content, created_at")
    .eq("entry_id", entry.id)
    .order("created_at", { ascending: true });

  const messages = ((msgs ?? []) as JournalMessage[]).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const photos = await getEntryPhotos(entry.id);
  const isQuote = entry.entry_type === "quote";

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <Link
          href="/journal"
          className="font-serif text-xs text-muted-foreground hover:text-foreground"
        >
          ← journal
        </Link>
        <p className="mt-6 font-serif text-sm text-muted-foreground tabular-nums">
          {formatDate(entry.entry_date)}
        </p>
        {isQuote ? (
          <QuoteEntryView
            entryId={entry.id}
            quote={entry.pull_quote ?? ""}
            attribution={entry.quote_attribution}
          />
        ) : (
          <EntryTitle
            entryId={entry.id}
            title={entry.title?.trim() || "Untitled"}
          />
        )}
      </div>
      <JournalPhotoGallery
        entryId={entry.id}
        initialPhotos={photos}
        editable
      />
      {/* Quote entries have no conversation — no transcript, no reply box. */}
      {!isQuote && (
        <ChatSurface
          entryId={entry.id}
          initialStatus={entry.status}
          initialMessages={messages}
          viewMode="history"
        />
      )}
    </div>
  );
}

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
