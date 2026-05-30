import { notFound } from "next/navigation";
import Link from "next/link";
import { ChatSurface } from "@/components/journal/chat-surface";
import { EntryOwnerMenuItems } from "@/components/journal/entry-owner-menu-items";
import { EntryTitle } from "@/components/journal/entry-title";
import { QuoteEntryView } from "@/components/journal/quote-entry-view";
import { RecapEntryView } from "@/components/journal/recap-entry-view";
import { JournalPhotoGallery } from "@/components/journal/journal-photo-gallery";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/journal/auth";
import {
  getEntriesImageGenerationStates,
  getEntryPhotos,
} from "@/app/(journal)/journal/actions";
import type { JournalEntry, JournalMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const userId = await requireUserId(supabase);

  const { data: entryRow } = await supabase
    .from("journal_entries")
    .select(
      "id, entry_date, user_id, status, entry_type, visibility, opening_question, summary, title, pull_quote, quote_attribution, recap_body, summary_stale, closed_at, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!entryRow) notFound();
  const entry = entryRow as JournalEntry;

  // You only ever control your own posts. A family member viewing someone
  // else's shared entry sees it read-only, with author attribution.
  const isAuthor = entry.user_id === userId;
  let authorName: string | null = null;
  if (!isAuthor) {
    const { data: member } = await supabase
      .from("journal_members")
      .select("name, email")
      .eq("user_id", entry.user_id)
      .maybeSingle();
    authorName =
      member?.name?.trim() || (member?.email as string | undefined) || "A family member";
  }

  const { data: msgs } = await supabase
    .from("journal_messages")
    .select("id, entry_id, role, content, created_at")
    .eq("entry_id", entry.id)
    .order("created_at", { ascending: true });

  const messages = ((msgs ?? []) as JournalMessage[]).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const [photos, imageGenerationByEntry] = await Promise.all([
    getEntryPhotos(entry.id),
    getEntriesImageGenerationStates([entry.id]),
  ]);
  const photoGenerationStatus = imageGenerationByEntry[entry.id] ?? null;
  const isQuote = entry.entry_type === "quote";
  const isRecap = entry.entry_type === "recap";
  const menuActions = isAuthor ? (
    <EntryOwnerMenuItems
      entryId={entry.id}
      initialVisibility={entry.visibility}
    />
  ) : null;
  const mediaViewer = (
    <JournalPhotoGallery
      entryId={entry.id}
      initialPhotos={photos}
      editable={isAuthor}
      showAttachAction={false}
      photoGenerationStatus={photoGenerationStatus}
      containerClassName="pt-6"
    />
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <Link
          href={isAuthor ? "/journal" : "/journal?feed=family"}
          className="font-serif text-xs text-muted-foreground hover:text-foreground"
        >
          ← journal
        </Link>
        <div className="mt-6 flex items-baseline gap-3">
          <p className="font-serif text-sm text-muted-foreground tabular-nums">
            {formatDate(entry.entry_date)}
          </p>
          {!isAuthor && authorName && (
            <p className="font-serif text-sm text-muted-foreground">
              {authorName}
            </p>
          )}
        </div>
        {isQuote ? (
          <QuoteEntryView
            entryId={entry.id}
            quote={entry.pull_quote ?? ""}
            attribution={entry.quote_attribution}
            readOnly={!isAuthor}
            afterTitle={mediaViewer}
            menuActions={menuActions}
          />
        ) : isRecap ? (
          <RecapEntryView
            entryId={entry.id}
            title={entry.title?.trim() || "Untitled"}
            body={entry.recap_body ?? ""}
            readOnly={!isAuthor}
            afterTitle={mediaViewer}
            menuActions={menuActions}
          />
        ) : (
          <EntryTitle
            entryId={entry.id}
            title={entry.title?.trim() || "Untitled"}
            readOnly={!isAuthor}
            afterTitle={mediaViewer}
            menuActions={menuActions}
          />
        )}
      </div>
      {/* Only standard entries have a conversation — no transcript or reply
          box for quote and recap entries. */}
      {entry.entry_type === "standard" && (
        <ChatSurface
          entryId={entry.id}
          initialStatus={entry.status}
          initialVisibility={entry.visibility}
          initialMessages={messages}
          viewMode="history"
          readOnly={!isAuthor}
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
