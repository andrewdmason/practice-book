"use client";

import { useMemo } from "react";
import type { PieceSection, PieceSectionTimestamp } from "@/lib/types";
import { SECTION_STATUS_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScrubberSection {
  section: PieceSection;
  startSeconds: number;
  endSeconds: number;
}

export function SectionScrubber({
  sections,
  timestamps,
  videoStart,
  videoEnd,
  currentTime,
  activeSectionId,
  onSectionClick,
}: {
  sections: PieceSection[];
  timestamps: PieceSectionTimestamp[];
  videoStart: number;
  videoEnd: number;
  currentTime: number;
  activeSectionId?: string;
  onSectionClick: (sectionId: string) => void;
}) {
  const totalDuration = videoEnd - videoStart;
  if (totalDuration <= 0) return null;

  const scrubberSections = useMemo(() => {
    const result: ScrubberSection[] = [];
    for (const section of sections) {
      const ts = timestamps.find((t) => t.section_id === section.id);
      if (!ts) continue;
      const start = Math.max(ts.start_seconds, videoStart);
      const end = ts.end_seconds
        ? Math.min(ts.end_seconds, videoEnd)
        : videoEnd;
      if (end > start) {
        result.push({ section, startSeconds: start, endSeconds: end });
      }
    }
    return result;
  }, [sections, timestamps, videoStart, videoEnd]);

  if (scrubberSections.length === 0) return null;

  // Playhead position as percentage
  const playheadPct =
    ((Math.max(videoStart, Math.min(currentTime, videoEnd)) - videoStart) /
      totalDuration) *
    100;

  return (
    <div className="relative flex h-6 w-full rounded-md overflow-hidden bg-muted/50">
      {scrubberSections.map(({ section, startSeconds, endSeconds }) => {
        const leftPct =
          ((startSeconds - videoStart) / totalDuration) * 100;
        const widthPct =
          ((endSeconds - startSeconds) / totalDuration) * 100;
        const isActive = section.id === activeSectionId;

        return (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className={cn(
              "absolute top-0 h-full flex items-center justify-center transition-opacity cursor-pointer hover:opacity-90",
              SECTION_STATUS_COLORS[section.status],
              isActive && "ring-1 ring-inset ring-foreground/30"
            )}
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
            }}
            title={section.label}
          >
            {widthPct > 8 && (
              <span className="text-[10px] font-medium text-white mix-blend-difference truncate px-1">
                {section.label}
              </span>
            )}
          </button>
        );
      })}

      {/* Playhead */}
      <div
        className="absolute top-0 h-full w-0.5 bg-foreground/80 pointer-events-none z-10"
        style={{ left: `${playheadPct}%` }}
      />
    </div>
  );
}
