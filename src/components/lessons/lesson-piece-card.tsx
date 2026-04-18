"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinutes } from "@/lib/timer-utils";
import { useLessonView } from "./lesson-view-context";
import { LessonSparkline } from "./lesson-sparkline";
import {
  getLessonPieceStats,
  type LessonPieceStats,
} from "@/app/(app)/lessons/stats-actions";
import {
  SECTION_STATUS_LABELS,
  type SectionStatus,
} from "@/lib/types";

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}

export function LessonPieceCard({
  pieceId,
  pieceName,
  pieceComposer,
}: {
  pieceId: string;
  pieceName: string;
  pieceComposer: string | null;
}) {
  const { lesson } = useLessonView();
  const [stats, setStats] = useState<LessonPieceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLessonPieceStats(lesson.id, pieceId).then((data) => {
      if (!cancelled) {
        setStats(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [lesson.id, pieceId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{pieceName}</CardTitle>
            {pieceComposer && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {pieceComposer}
              </div>
            )}
          </div>
          <Link
            href={`/repertoire/${pieceId}`}
            className="text-muted-foreground hover:text-foreground"
            title="Open piece detail"
          >
            <ExternalLinkIcon className="size-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading || !stats ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <StatRow
                label="Time since last lesson"
                value={formatMinutes(stats.pieceTimeSeconds)}
              />
              <StatRow
                label="Days practiced"
                value={
                  stats.daysPracticed > 0
                    ? `${stats.daysPracticed} of ${stats.calendarDays}`
                    : "—"
                }
              />
              <StatRow
                label="Target tempo"
                value={
                  stats.targetTempo ? `${stats.targetTempo} bpm` : "—"
                }
              />
              <StatRow
                label="Most recent tempo"
                value={
                  stats.currentTempo ? `${stats.currentTempo} bpm` : "—"
                }
              />
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Practice trend (last {stats.sparkline.length || 6})
              </div>
              <LessonSparkline points={stats.sparkline} />
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Section progress
              </div>
              {stats.sectionDeltas.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">
                  No status changes since last lesson
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {stats.sectionDeltas.map((d) => (
                    <div
                      key={d.sectionId}
                      className="flex items-baseline justify-between text-xs gap-2"
                    >
                      <span className="font-medium">Section {d.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {d.isNew
                          ? `new at ${d.toStatus}`
                          : `${d.fromStatus} → ${d.toStatus}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Re-export for external use if needed
export { SECTION_STATUS_LABELS };
export type { SectionStatus };
