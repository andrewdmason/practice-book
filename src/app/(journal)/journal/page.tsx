import { HistoryList } from "@/components/journal/history-list";
import { JournalListDropZone } from "@/components/journal/journal-list-drop-zone";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/journal/auth";
import { getEntriesPhotos } from "@/app/(journal)/journal/actions";
import type { JournalEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) {
  const { feed } = await searchParams;
  const isFamily = feed === "family";

  const supabase = await createClient();
  const userId = await requireUserId(supabase);

  const columns =
    "id, entry_date, user_id, status, entry_type, visibility, opening_question, freeform_started_at, summary, title, pull_quote, quote_attribution, summary_stale, closed_at, created_at, updated_at";

  // Mine: the caller's own entries (private + family). The entries SELECT policy
  // is "own rows OR visibility = 'family'", so without the user_id filter this
  // query would also pull in *other* members' shared entries — Mine must stay
  // own-only. Family: every member's closed, family-shared entries.
  let query = supabase.from("journal_entries").select(columns);
  query = isFamily
    ? query.eq("visibility", "family").eq("status", "closed")
    : query.eq("user_id", userId);
  const { data } = await query;

  // Newest-first by entry_date — the date shown in the feed — with created_at
  // breaking ties within a day. Done client-side to defend against any
  // chained-order quirks in supabase-js.
  const entries = ((data ?? []) as JournalEntry[]).sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? 1 : -1;
    return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
  });

  // Author names for the Family feed (own rows can read every member's name via
  // RLS now). Keyed by user_id; falls back to email, then a generic label.
  const authorByUser = new Map<string, string>();
  if (isFamily && entries.length > 0) {
    const { data: members } = await supabase
      .from("journal_members")
      .select("user_id, name, email");
    for (const m of members ?? []) {
      if (!m.user_id) continue;
      authorByUser.set(
        m.user_id as string,
        (m.name as string | null)?.trim() || (m.email as string) || "Family member"
      );
    }
  }

  const photosByEntry = await getEntriesPhotos(entries.map((e) => e.id));
  const entriesWithPhotos = entries
    .map((e) => ({
      ...e,
      photos: photosByEntry[e.id] ?? [],
      authorName: isFamily
        ? authorByUser.get(e.user_id) ?? "Family member"
        : null,
    }))
    // Hide abandoned entries: an open entry never started (no opening question
    // picked, no freeform writing) with nothing attached is a row left behind
    // by visiting /journal/new without writing — not a real entry. (Family
    // entries are all closed, so this only affects Mine.)
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
      <HistoryList
        entries={entriesWithPhotos}
        mode={isFamily ? "family" : "mine"}
        emptyMessage={
          isFamily ? "Nothing shared with the family yet." : "No entries yet."
        }
      />
    </div>
  );
}
