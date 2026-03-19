"use client";

import { cn } from "@/lib/utils";
import type { MasteryLevel } from "@/lib/types";
import { MASTERY_LEVELS, MASTERY_LEVEL_LABELS } from "@/lib/types";

const masteryColors: Record<MasteryLevel, string> = {
  learning:
    "data-[selected=true]:bg-amber-100 data-[selected=true]:text-amber-800 data-[selected=true]:border-amber-300",
  playable:
    "data-[selected=true]:bg-emerald-50 data-[selected=true]:text-emerald-700 data-[selected=true]:border-emerald-300",
  performance_ready:
    "data-[selected=true]:bg-sky-50 data-[selected=true]:text-sky-700 data-[selected=true]:border-sky-300",
  memorized:
    "data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary data-[selected=true]:border-primary/30",
};

export function MasterySelector({
  value,
  onChange,
  className,
}: {
  value: MasteryLevel;
  onChange: (level: MasteryLevel) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {MASTERY_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          data-selected={value === level}
          onClick={() => onChange(level)}
          className={cn(
            "rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted",
            masteryColors[level],
            value !== level && "text-muted-foreground"
          )}
        >
          {MASTERY_LEVEL_LABELS[level]}
        </button>
      ))}
    </div>
  );
}
