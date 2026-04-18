"use client";

import { formatMinutes } from "@/lib/timer-utils";
import type { PieceSparklinePoint } from "@/app/(app)/lessons/stats-actions";

export function LessonSparkline({
  points,
  height = 40,
}: {
  points: PieceSparklinePoint[];
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">
        No lesson history yet
      </div>
    );
  }

  const max = Math.max(1, ...points.map((p) => p.totalSeconds));

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {points.map((p, i) => {
        const pct = max > 0 ? (p.totalSeconds / max) * 100 : 0;
        const isCurrent = i === points.length - 1;
        return (
          <div
            key={p.lessonDate}
            className="flex-1 flex flex-col items-stretch justify-end group relative min-w-[8px]"
            title={`${p.lessonDate} — ${formatMinutes(p.totalSeconds)}`}
          >
            <div
              className={
                isCurrent
                  ? "bg-primary rounded-sm"
                  : "bg-primary/30 rounded-sm"
              }
              style={{ height: `${Math.max(pct, 4)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
