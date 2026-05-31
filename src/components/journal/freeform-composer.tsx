"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { FinishPostDialog } from "@/components/journal/finish-post-dialog";
import { JournalPhotoGallery } from "@/components/journal/journal-photo-gallery";
import {
  closeEntry,
  saveFreeformDraft,
  setEntryVisibility,
} from "@/app/(journal)/journal/actions";
import type {
  JournalMediaType,
  JournalPhotoSource,
  JournalVisibility,
} from "@/lib/types";

type Media = {
  id: string;
  mediaType: JournalMediaType;
  source: JournalPhotoSource;
  displayUrl: string;
  videoUrl: string | null;
};

/**
 * The freeform blog-post composer reached from "Start with your own words".
 * Unlike the AI-interview chat surface, this is just a page to write on: a
 * title you write yourself, a body, attached photos, and a single "Finish post"
 * action — no Send, no conversation. The draft autosaves so leaving mid-post
 * never loses anything; finishing closes the entry and runs the wrap pass,
 * which fills in a pull quote (and summary) without touching your title.
 */
export function FreeformComposer({
  entryId,
  initialTitle,
  initialBody,
  initialVisibility = "private",
  initialPhotos,
}: {
  entryId: string;
  initialTitle: string;
  initialBody: string;
  initialVisibility?: JournalVisibility;
  initialPhotos: Media[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [selectedVisibility, setSelectedVisibility] =
    useState<JournalVisibility>(initialVisibility);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  // The latest values, so the debounced autosave and the finish flush always
  // persist what's on screen without re-subscribing effects on every keystroke.
  const latest = useRef({ title, body });
  // Tracks what's already persisted, so autosave skips no-op writes and a stale
  // save can't clobber newer content.
  const savedRef = useRef({ title: initialTitle, body: initialBody });

  useEffect(() => {
    latest.current = { title, body };
  }, [title, body]);

  const hasContent = body.trim().length > 0;

  // Auto-grow the body textarea to fit its content.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  const flush = useCallback(async () => {
    const { title: t, body: b } = latest.current;
    if (t === savedRef.current.title && b === savedRef.current.body) return;
    savedRef.current = { title: t, body: b };
    try {
      await saveFreeformDraft(entryId, t, b);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [entryId]);

  // Debounced autosave: persist a beat after the writer pauses.
  useEffect(() => {
    if (title === savedRef.current.title && body === savedRef.current.body) {
      return;
    }
    const id = setTimeout(() => void flush(), 800);
    return () => clearTimeout(id);
  }, [title, body, flush]);

  async function handleFinish() {
    if (closing || !hasContent) return;
    setClosing(true);
    setError(null);
    try {
      // Make sure the latest title/body are saved as the entry's message before
      // the wrap pass reads it, then close and hand off to the wrap.
      await flush();
      await setEntryVisibility(entryId, selectedVisibility);
      await closeEntry(entryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setClosing(false);
      return;
    }
    setFinishDialogOpen(false);
    // Fire-and-forget: the wrap writes the summary/pull quote on its own. We
    // navigate away without waiting; the list polls until the fields land.
    void fetch("/journal/api/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId }),
    }).catch((err) => console.error("[journal] wrap request failed:", err));
    router.push("/journal");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-24 pt-6">
      {/* The finish action rides along just under the header so it stays within
          reach no matter how far down a long post you've scrolled. */}
      <div className="sticky top-14 z-30 -mx-6 flex justify-end bg-background/80 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <button
          type="button"
          onClick={() => setFinishDialogOpen(true)}
          disabled={closing || !hasContent}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 font-serif text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-40"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {closing ? "Wrapping..." : "Finish post"}
        </button>
        <FinishPostDialog
          open={finishDialogOpen}
          onOpenChange={(open) => {
            if (!closing) setFinishDialogOpen(open);
          }}
          selectedVisibility={selectedVisibility}
          onSelectedVisibilityChange={setSelectedVisibility}
          hasUnsentReply={false}
          closing={closing}
          onFinish={() => void handleFinish()}
        />
      </div>

      {/* Notion-style header: any attached photos read as a cover above the
          title, and the "Attach a photo" control fades in only while hovering
          (or tabbing into) the title region. */}
      <div className="group mt-4">
        <JournalPhotoGallery
          entryId={entryId}
          initialPhotos={initialPhotos}
          editable={!closing}
          showAttachAction
          containerClassName=""
          attachActionClassName="pointer-events-none opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void flush()}
          onKeyDown={(e) => {
            // Enter in the title drops the cursor into the body, like a
            // blog/Notion editor — the title is a single line.
            if (e.key === "Enter") {
              e.preventDefault();
              bodyRef.current?.focus();
            }
          }}
          placeholder="Title"
          disabled={closing}
          className="mt-2 w-full border-0 bg-transparent font-serif text-3xl font-normal leading-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-60"
        />
      </div>

      <textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => void flush()}
        rows={1}
        placeholder="Write your post…"
        disabled={closing}
        className="mt-6 min-h-[12rem] w-full resize-none overflow-hidden border-0 bg-transparent font-serif text-lg leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-60"
      />

      {error && (
        <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
