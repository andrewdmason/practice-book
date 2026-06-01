"use client";

import { useState, useTransition } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PerformanceFormDialog } from "@/components/repertoire/performance-form-dialog";
import { deletePerformance } from "@/app/practice/repertoire/performance-actions";
import type { Performance } from "@/lib/types";

type Owner = { pieceId: string } | { workId: string };

function formatDate(date: string | null): string | null {
  if (!date) return null;
  // date is YYYY-MM-DD; parse as local to avoid timezone drift.
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** A short label for the switcher tiles, falling back through title → date → "Performance". */
function shortLabel(performance: Performance): string {
  return (
    performance.title ||
    formatDate(performance.performed_on) ||
    "Performance"
  );
}

export function PerformancesPanel({
  performances,
  owner,
}: {
  performances: Performance[];
  owner: Owner;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    performances[0]?.id ?? null
  );
  const [isPending, startTransition] = useTransition();

  // Keep the selection valid if the list changes (add/delete revalidates props).
  const selected =
    performances.find((p) => p.id === selectedId) ?? performances[0] ?? null;

  // Nothing to show until there's at least one performance. Adding is done
  // from the overflow menu next to the piece/work name.
  if (!selected) {
    return null;
  }

  const metaParts = [
    selected.performers,
    selected.location,
    formatDate(selected.performed_on),
  ].filter(Boolean) as string[];

  function handleDelete(id: string) {
    if (!window.confirm("Delete this performance?")) return;
    startTransition(async () => {
      await deletePerformance(id);
      if (selectedId === id) setSelectedId(null);
    });
  }

  const others = performances.filter((p) => p.id !== selected.id);

  return (
    <div className="mb-6">
      <h2 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Performances
      </h2>

      {/* Featured player */}
      <div className="rounded-md overflow-hidden">
        <div className="relative aspect-video bg-muted">
          <iframe
            key={selected.youtube_video_id}
            className="absolute inset-0 size-full"
            src={`https://www.youtube.com/embed/${selected.youtube_video_id}?rel=0&modestbranding=1`}
            title={selected.title ?? "Performance"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>

      {/* Featured metadata + controls */}
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {selected.title && (
            <p className="text-sm font-medium">{selected.title}</p>
          )}
          {metaParts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {metaParts.join(" · ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <PerformanceFormDialog
            owner={owner}
            performance={selected}
            trigger={
              <Button variant="ghost" size="icon" className="size-7">
                <PencilIcon className="size-3.5" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            disabled={isPending}
            onClick={() => handleDelete(selected.id)}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Switcher for other performances */}
      {others.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {others.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className="group shrink-0 text-left"
              title={shortLabel(p)}
            >
              <div className="relative aspect-video w-32 overflow-hidden rounded bg-muted ring-1 ring-border transition-opacity group-hover:opacity-80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://img.youtube.com/vi/${p.youtube_video_id}/mqdefault.jpg`}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
              </div>
              <p className="mt-1 w-32 truncate text-xs text-muted-foreground">
                {shortLabel(p)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
