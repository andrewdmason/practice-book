"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Play } from "lucide-react";
import type { JournalEntry, JournalMediaType } from "@/lib/types";

type HistoryEntry = JournalEntry & {
  photos: { id: string; displayUrl: string; mediaType: JournalMediaType }[];
  photoGenerationStatus?: "pending" | "generating" | null;
  authorName?: string | null;
  authorPhotoUrl?: string | null;
};

// A just-closed entry whose wrap pass (title/summary/pull_quote) hasn't landed
// yet. Bounded to 60s after closing so a failed or abandoned wrap stops
// showing the generating state instead of spinning forever.
function isGenerating(e: JournalEntry): boolean {
  if (e.status !== "closed") return false;
  // Only standard entries run a wrap pass; quote and recap entries get their
  // title on save, so a titleless one of those isn't "generating".
  if (e.entry_type !== "standard") return false;
  if (e.title && e.title.trim().length > 0) return false;
  if (!e.closed_at) return false;
  return Date.now() - Date.parse(e.closed_at) < 60_000;
}

export function HistoryList({
  entries,
  mode = "mine",
  emptyMessage = "No entries yet.",
}: {
  entries: HistoryEntry[];
  /** "mine" shows a "shared" badge on own family posts; "family" shows the
   * author's name on every card. */
  mode?: "mine" | "family";
  emptyMessage?: string;
}) {
  const router = useRouter();

  // While any entry is mid-wrap, poll the server until its AI fields land.
  useEffect(() => {
    if (!entries.some((e) => isGenerating(e) || e.photoGenerationStatus)) return;
    const id = setInterval(() => router.refresh(), 1500);
    return () => clearInterval(id);
  }, [entries, router]);

  if (entries.length === 0) {
    return (
      <p className="font-serif text-muted-foreground italic">{emptyMessage}</p>
    );
  }

  return (
    <ul className="space-y-10">
      {entries.map((e) => {
        const generating = isGenerating(e);
        return (
          <li key={e.id}>
            <Link href={`/journal/${e.id}`} className="group block">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-xs text-muted-foreground tabular-nums">
                  {formatDate(e.entry_date)}
                </span>
                {mode === "family" && e.authorName && (
                  <span className="font-serif text-xs text-muted-foreground">
                    {e.authorName}
                  </span>
                )}
                {e.status === "open" && (
                  <span
                    title="This post has not been finished or shared."
                    className="rounded-full border border-yellow-300 bg-yellow-100 px-2 py-0.5 font-serif text-[10px] uppercase tracking-wider text-yellow-900"
                  >
                    draft
                  </span>
                )}
                {mode === "mine" &&
                  e.visibility === "family" &&
                  e.status === "closed" && (
                    <span className="font-serif text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      shared to family
                    </span>
                  )}
              </div>
              {generating ? (
                <p className="mt-2 font-serif text-2xl italic leading-tight text-muted-foreground/50 animate-pulse">
                  summing up…
                </p>
              ) : e.entry_type === "quote" ? (
                // Quote entries read as a pulled quote: italic heading with an
                // oversized hanging quotation mark, then an em-dashed
                // attribution — visually distinct from the upright titles
                // around them.
                <>
                  <p className="mt-2 font-serif text-2xl italic leading-tight text-foreground group-hover:underline group-hover:underline-offset-4 group-hover:decoration-foreground/30">
                    <span
                      aria-hidden
                      className="mr-1 align-[-0.2em] font-serif text-4xl not-italic leading-none text-muted-foreground/40"
                    >
                      “
                    </span>
                    {displayTitle(e)}
                  </p>
                  {e.quote_attribution && (
                    <p className="mt-3 font-serif text-base italic leading-relaxed text-muted-foreground">
                      — {e.quote_attribution}
                    </p>
                  )}
                </>
              ) : e.entry_type === "recap" ? (
                // Recaps read as an upright title with an AI-generated subtitle
                // summarizing the month's threads.
                <>
                  <p className="mt-2 font-serif text-2xl leading-tight text-foreground group-hover:underline group-hover:underline-offset-4 group-hover:decoration-foreground/30">
                    {displayTitle(e)}
                  </p>
                  {e.summary && (
                    <p className="mt-3 line-clamp-2 font-serif text-base italic leading-relaxed text-muted-foreground">
                      {e.summary}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-2 font-serif text-2xl leading-tight text-foreground group-hover:underline group-hover:underline-offset-4 group-hover:decoration-foreground/30">
                    {displayTitle(e)}
                  </p>
                  {e.pull_quote && (
                    <p className="mt-3 font-serif text-base italic leading-relaxed text-muted-foreground">
                      <span className="mr-1 text-muted-foreground/60">“</span>
                      {e.pull_quote}
                      <span className="ml-0.5 text-muted-foreground/60">”</span>
                    </p>
                  )}
                </>
              )}
              {(e.photos.length > 0 || e.photoGenerationStatus) && (
                <div className="mt-4 flex gap-2">
                  {e.photoGenerationStatus && (
                    <div className="flex h-52 min-w-0 flex-1 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 font-serif text-sm italic text-muted-foreground">
                      <span className="relative flex size-10 items-center justify-center">
                        <ImagePlus className="size-7 opacity-35" />
                        <Loader2 className="absolute size-10 animate-spin opacity-45" />
                      </span>
                      <span>making a photo…</span>
                    </div>
                  )}
                  {e.photos.slice(0, 3).map((photo) => (
                    <div
                      key={photo.id}
                      className="relative h-52 min-w-0 flex-1 overflow-hidden rounded-lg bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.displayUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                      {photo.mediaType === "video" && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="rounded-full bg-black/55 p-3">
                            <Play className="size-5 fill-white text-white" />
                          </span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function displayTitle(e: JournalEntry): string {
  // Quote entries have no AI title — the quote itself is the heading.
  if (e.entry_type === "quote") return e.pull_quote?.trim() || "untitled quote";
  if (e.title && e.title.trim().length > 0) return e.title;
  if (e.summary && e.summary.trim().length > 0) return e.summary;
  if (e.opening_question && e.opening_question.trim().length > 0) return e.opening_question;
  if (e.status === "open") return "draft";
  return "untitled";
}

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
