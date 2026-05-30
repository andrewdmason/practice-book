"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { generateAndAttachEntryPhoto } from "@/app/(journal)/journal/actions";

export function GeneratedPhotoPanel({ entryId }: { entryId: string }) {
  const [attached, setAttached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();
  const router = useRouter();

  function handleGenerate() {
    setError(null);
    setAttached(false);
    startGenerating(async () => {
      const result = await generateAndAttachEntryPhoto(entryId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAttached(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="inline-flex items-center gap-1.5 font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50 disabled:hover:no-underline"
      >
        {generating ? (
          <Loader2 className="size-4 animate-spin" />
        ) : attached ? (
          <Check className="size-4" />
        ) : (
          <ImagePlus className="size-4" />
        )}
        {generating ? "making…" : attached ? "attached" : "Generate a photo"}
      </button>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
