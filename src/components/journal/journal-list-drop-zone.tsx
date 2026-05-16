"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  createFreeformEntry,
  setEntryDate,
} from "@/app/(journal)/journal/actions";
import {
  MAX_UPLOAD_BYTES,
  detectMediaType,
  formatBytes,
  uploadJournalMedia,
} from "@/lib/journal/photo-upload";
import { readImageDateTaken } from "@/lib/journal/image-date";
import { localDate } from "@/lib/date-utils";

type DatePrompt = { entryId: string; date: string };

/**
 * Drag photos or videos onto the journal list to start a new entry. Creates a
 * fresh freeform entry (no opening question), attaches the dropped media, then
 * hands off to /journal/new. When a dropped photo carries an EXIF date that
 * isn't today, the user is offered to date the entry to when it was taken.
 */
export function JournalListDropZone() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePrompt, setDatePrompt] = useState<DatePrompt | null>(null);

  const startEntry = useCallback(
    async (files: File[]) => {
      const tooBig = files.find((f) => f.size > MAX_UPLOAD_BYTES);
      if (tooBig) {
        setError(
          `“${tooBig.name}” is ${formatBytes(tooBig.size)} — files must be under ${formatBytes(
            MAX_UPLOAD_BYTES
          )}.`
        );
        return;
      }
      setBusy(true);
      setError(null);
      try {
        // EXIF dates only exist on photos; read the first dropped photo, if any.
        const firstPhoto = files.find((f) => detectMediaType(f) === "photo");
        const photoDate = firstPhoto
          ? await readImageDateTaken(firstPhoto)
          : null;
        const entryId = await createFreeformEntry();
        await Promise.all(files.map((f) => uploadJournalMedia(entryId, f)));
        if (photoDate && photoDate !== localDate()) {
          setBusy(false);
          setDatePrompt({ entryId, date: photoDate });
          return;
        }
        router.push(`/journal/new?entry=${entryId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start entry");
        setBusy(false);
      }
    },
    [router]
  );

  const resolveDate = useCallback(
    async (usePhotoDate: boolean) => {
      if (!datePrompt) return;
      if (usePhotoDate) {
        try {
          await setEntryDate(datePrompt.entryId, datePrompt.date);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to set date");
        }
      }
      router.push(`/journal/new?entry=${datePrompt.entryId}`);
    },
    [datePrompt, router]
  );

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth -= 1;
      if (depth <= 0) {
        depth = 0;
        setDragging(false);
      }
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => detectMediaType(f) !== null
      );
      if (files.length > 0) void startEntry(files);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [startEntry]);

  return (
    <>
      {(dragging || busy) && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-foreground/40 px-10 py-8 font-serif text-sm text-muted-foreground">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy
              ? "Starting a new entry…"
              : "Drop photo or video to start a new entry"}
          </div>
        </div>
      )}

      {datePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg">
            <p className="font-serif text-base text-foreground">
              This photo was taken on {formatDate(datePrompt.date)}.
            </p>
            <p className="mt-1 font-serif text-sm text-muted-foreground">
              Date this entry to then?
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => void resolveDate(false)}
                className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Keep today
              </button>
              <button
                type="button"
                onClick={() => void resolveDate(true)}
                className="rounded-md bg-foreground px-3 py-1.5 font-serif text-sm text-background hover:bg-foreground/90"
              >
                Use photo date
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-6 font-serif text-xs text-destructive">{error}</p>
      )}
    </>
  );
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
