import { HistoryList } from "@/components/journal/history-list";
import { createClient } from "@/lib/supabase/server";
import type { JournalEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_entries")
    .select(
      "id, entry_date, status, opening_question, summary, title, pull_quote, summary_stale, closed_at, created_at, updated_at"
    );

  // Sort newest-first by created_at (ignoring entry_date, since it's a date
  // and ties happen constantly with multiple threads per day). Doing this
  // client-side defends against any chained-order quirks in supabase-js.
  const entries = ((data ?? []) as JournalEntry[]).sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-24 pt-12">
      <HistoryList entries={entries} />
    </div>
  );
}
