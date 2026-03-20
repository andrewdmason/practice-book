"use client";

import { ClockIcon, MusicIcon, BookOpenIcon } from "lucide-react";
import { formatMinutes } from "@/lib/timer-utils";
import { TIMER_CATEGORY_LABELS } from "@/lib/timer-utils";
import type { TimeSummaryEntry } from "@/lib/types";

export function TimeSummary({
  entries,
  label = "Today",
  onItemClick,
}: {
  entries: TimeSummaryEntry[];
  label?: string;
  onItemClick?: (focusKey: string) => void;
}) {
  if (entries.length === 0) return null;

  const totalSeconds = entries.reduce((sum, e) => sum + e.total_seconds, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ClockIcon className="size-4 text-muted-foreground" />
          {label}
        </div>
        <span className="text-sm font-semibold tabular-nums">
          {formatMinutes(totalSeconds)}
        </span>
      </div>

      <div className="space-y-1">
        {entries.map((entry) => {
          const entryLabel =
            entry.piece_name ?? TIMER_CATEGORY_LABELS[entry.category] ?? entry.category;
          const Icon = entry.category === "piece" ? MusicIcon : BookOpenIcon;
          const focusKey = entry.piece_id ?? entry.category;
          const clickable = !!onItemClick;

          return (
            <button
              key={focusKey}
              onClick={() => onItemClick?.(focusKey)}
              disabled={!clickable}
              className={`flex w-full items-center justify-between py-1 text-sm rounded-md px-1 -mx-1 transition-colors ${
                clickable
                  ? "hover:bg-muted/50 cursor-pointer"
                  : "cursor-default"
              }`}
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-3.5" />
                <span className="truncate">{entryLabel}</span>
              </div>
              <span className="tabular-nums text-muted-foreground">
                {formatMinutes(entry.total_seconds)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
