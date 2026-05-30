"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, RefreshCcw } from "lucide-react";
import {
  attachGeneratedEntryPhoto,
  generateEntryPhotoPreview,
} from "@/app/(journal)/journal/actions";

type Preview = {
  generationId: string;
  displayUrl: string;
};

export function GeneratedPhotoPanel({ entryId }: { entryId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [attached, setAttached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();
  const [attaching, startAttaching] = useTransition();
  const router = useRouter();

  function handleGenerate() {
    setError(null);
    setAttached(false);
    startGenerating(async () => {
      const result = await generateEntryPhotoPreview(entryId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview({
        generationId: result.generationId,
        displayUrl: result.displayUrl,
      });
    });
  }

  function handleAttach() {
    if (!preview) return;
    setError(null);
    startAttaching(async () => {
      const result = await attachGeneratedEntryPhoto(preview.generationId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAttached(true);
      router.refresh();
    });
  }

  const busy = generating || attaching;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pt-4">
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-serif text-sm italic text-muted-foreground">
            Make a silly photo from this post
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="inline-flex items-center gap-1.5 font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50 disabled:hover:no-underline"
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : preview ? (
              <RefreshCcw className="size-4" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            {generating ? "making…" : preview ? "try again" : "generate photo"}
          </button>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </p>
        )}

        {preview && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <button
              type="button"
              className="group relative h-48 w-48 overflow-hidden rounded-md border border-border bg-muted"
              onClick={handleAttach}
              disabled={busy || attached}
              aria-label="Attach generated photo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.displayUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              {attached && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <span className="rounded-full bg-background p-2 text-foreground shadow-sm">
                    <Check className="size-5" />
                  </span>
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleAttach}
              disabled={busy || attached}
              className="inline-flex items-center gap-1.5 self-start font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50 disabled:hover:no-underline"
            >
              {attaching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : attached ? (
                <Check className="size-4" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              {attaching ? "attaching…" : attached ? "attached" : "attach to post"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
