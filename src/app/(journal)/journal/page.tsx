import Link from "next/link";
import { HistoryList } from "@/components/journal/history-list";
import { JournalListDropZone } from "@/components/journal/journal-list-drop-zone";
import { createClient } from "@/lib/supabase/server";
import { getEntriesPhotos } from "@/app/(journal)/journal/actions";
import type { JournalEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_entries")
    .select(
      "id, entry_date, status, entry_type, opening_question, freeform_started_at, summary, title, pull_quote, quote_attribution, summary_stale, closed_at, created_at, updated_at"
    );

  // Sort newest-first by entry_date — the date shown in the feed — with
  // created_at breaking ties within a day (multiple threads per day are
  // common). For standard/quote entries entry_date is the creation day, so
  // this matches creation order; recaps deliberately set entry_date apart from
  // paste time, and sorting on it keeps them in their dated slot. Done
  // client-side to defend against any chained-order quirks in supabase-js.
  const entries = ((data ?? []) as JournalEntry[]).sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? 1 : -1;
    return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
  });

  const photosByEntry = await getEntriesPhotos(entries.map((e) => e.id));
  const entriesWithPhotos = entries
    .map((e) => ({
      ...e,
      photos: photosByEntry[e.id] ?? [],
    }))
    // Hide abandoned entries: an open entry never started (no opening question
    // picked, no freeform writing) with nothing attached is a row left behind
    // by visiting /journal/new without writing — not a real entry.
    .filter(
      (e) =>
        !(
          e.status === "open" &&
          !e.opening_question &&
          !e.freeform_started_at &&
          e.photos.length === 0
        )
    );

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-24 pt-12">
      <JournalListDropZone />
      <div className="mb-10 flex justify-end">
        <Link
          href="/journal/new"
          className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          + new entry
        </Link>
      </div>
      <HistoryList entries={entriesWithPhotos} />
    </div>
  );
}
