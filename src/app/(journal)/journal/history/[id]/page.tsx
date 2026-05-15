import { notFound } from "next/navigation";
import Link from "next/link";
import { ChatSurface } from "@/components/journal/chat-surface";
import { EntryTitle } from "@/components/journal/entry-title";
import { JournalEntryScope } from "@/components/journal/journal-entry-scope";
import { createClient } from "@/lib/supabase/server";
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
      "id, entry_date, status, opening_question, summary, title, pull_quote, summary_stale, closed_at, created_at, updated_at"
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

  return (
    <div className="flex flex-1 flex-col">
      <JournalEntryScope id={entry.id} />
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <Link
          href="/journal/history"
          className="font-serif text-xs text-muted-foreground hover:text-foreground"
        >
          ← history
        </Link>
        <p className="mt-6 font-serif text-sm text-muted-foreground tabular-nums">
          {formatDate(entry.entry_date)}
        </p>
        {entry.title && (
          <EntryTitle entryId={entry.id} title={entry.title} />
        )}
      </div>
      <ChatSurface
        entryId={entry.id}
        initialStatus={entry.status}
        initialMessages={messages}
        initialSummary={entry.summary}
        viewMode="history"
      />
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
