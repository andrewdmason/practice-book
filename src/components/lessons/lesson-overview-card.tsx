"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinutes } from "@/lib/timer-utils";
import { useLessonView } from "./lesson-view-context";
import {
  getLessonOverviewExtras,
  getLessonOverviewTrend,
  type LessonOverviewExtras,
  type OverviewTrendPoint,
} from "@/app/practice/lessons/stats-actions";
import { LessonOverviewTrend } from "./lesson-overview-trend";
import { cn } from "@/lib/utils";

function daysBetween(a: string, b: string): number {
  const ma = new Date(a + "T12:00:00").getTime();
  const mb = new Date(b + "T12:00:00").getTime();
  return Math.round((mb - ma) / 86400000);
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}

export function LessonOverviewCard() {
  const { lesson, setActiveSectionId } = useLessonView();
  const [extras, setExtras] = useState<LessonOverviewExtras | null>(null);
  const [trend, setTrend] = useState<OverviewTrendPoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLessonOverviewExtras(lesson.id).then((data) => {
      if (!cancelled) setExtras(data);
    });
    getLessonOverviewTrend(lesson.id).then((data) => {
      if (!cancelled) setTrend(data);
    });
    return () => {
      cancelled = true;
    };
  }, [lesson.id]);

  const { timeSummary, previousLessonDate, date, completed_at } = lesson;
  const endDate = date ?? new Date().toISOString().slice(0, 10);
  const daysSinceLast = previousLessonDate
    ? daysBetween(previousLessonDate, endDate)
    : null;

  const averagePerDay =
    timeSummary.dayCount > 0
      ? Math.round(timeSummary.totalSeconds / timeSummary.dayCount)
      : 0;

  const maxPieceSeconds = timeSummary.entries.reduce(
    (max, e) => Math.max(max, e.total_seconds),
    0
  );

  const handlePieceClick = (pieceId: string) => {
    const entry = lesson.entries.find((e) => e.piece_id === pieceId);
    if (entry) setActiveSectionId(entry.id);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {completed_at ? "Lesson summary" : "Since last lesson"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <StatRow
            label="Total practice"
            value={formatMinutes(timeSummary.totalSeconds)}
          />
          <StatRow
            label="Days practiced"
            value={`${timeSummary.dayCount} of ${timeSummary.calendarDays}`}
          />
          <StatRow
            label="Average per day"
            value={averagePerDay > 0 ? formatMinutes(averagePerDay) : "—"}
          />
          {daysSinceLast !== null && (
            <StatRow label="Days since last lesson" value={daysSinceLast} />
          )}
          <StatRow
            label="Longest session"
            value={
              extras === null
                ? "…"
                : extras.longestSessionSeconds > 0
                ? formatMinutes(extras.longestSessionSeconds)
                : "—"
            }
          />
          <StatRow
            label="Sections advanced"
            value={extras === null ? "…" : extras.sectionsAdvancedCount}
          />
        </div>

        {timeSummary.entries.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              By piece
            </div>
            <div className="flex flex-col gap-1.5">
              {timeSummary.entries.map((e) => {
                const pct =
                  maxPieceSeconds > 0
                    ? (e.total_seconds / maxPieceSeconds) * 100
                    : 0;
                const clickable = e.piece_id !== "__general__";
                return (
                  <button
                    key={e.piece_id}
                    type="button"
                    onClick={
                      clickable ? () => handlePieceClick(e.piece_id) : undefined
                    }
                    disabled={!clickable}
                    className={cn(
                      "text-left w-full",
                      clickable && "hover:bg-muted/60 rounded px-1 -mx-1"
                    )}
                  >
                    <div className="flex items-baseline justify-between text-xs gap-2">
                      <span className="truncate">{e.piece_name}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        {formatMinutes(e.total_seconds)}
                        {e.day_count && e.day_count > 0 ? (
                          <span className="opacity-60">
                            {" · "}
                            {formatMinutes(
                              Math.round(e.total_seconds / e.day_count)
                            )}
                            /day
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full bg-primary/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {trend && trend.length > 1 && <LessonOverviewTrend points={trend} />}
      </CardContent>
    </Card>
  );
}
