"use client";

import { useMemo, useState } from "react";
import { CircleIcon, PauseIcon, PlayIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useVideo } from "@/components/video/video-context";
import { useMetronome } from "@/components/metronome/metronome-context";
import { practiceTempo } from "@/lib/section-utils";
import type { PieceSection, PieceSectionTimestamp } from "@/lib/types";
import {
  SECTION_STATUS_COLORS,
  SECTION_STATUS_DOT_COLORS,
  SECTION_STATUS_LABELS,
} from "@/lib/types";
import type { SectionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const SECTION_SCRUBBER_TEXT_COLORS: Record<SectionStatus, string> = {
  0: "text-foreground/70",
  1: "text-foreground/80",
  2: "text-foreground/80",
  3: "text-foreground/80",
  4: "text-white",
  5: "text-white",
  6: "text-white",
  7: "text-white",
  8: "text-white",
};

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
  pieceTargetTempo,
  onSectionClick,
  onStatusCycle,
}: {
  sections: PieceSection[];
  timestamps: PieceSectionTimestamp[];
  videoStart: number;
  videoEnd: number;
  currentTime: number;
  activeSectionId?: string;
  pieceTargetTempo?: number | null;
  onSectionClick: (sectionId: string) => void;
  onStatusCycle?: (sectionId: string) => void;
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
          <ScrubberSegment
            key={section.id}
            section={section}
            leftPct={leftPct}
            widthPct={widthPct}
            isActive={isActive}
            startSeconds={startSeconds}
            pieceTargetTempo={pieceTargetTempo ?? null}
            onSectionClick={() => onSectionClick(section.id)}
            onStatusCycle={onStatusCycle ? () => onStatusCycle(section.id) : undefined}
          />
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

/* ------------------------------------------------------------------ */
/*  Segment with popover                                               */
/* ------------------------------------------------------------------ */

function ScrubberSegment({
  section,
  leftPct,
  widthPct,
  isActive,
  startSeconds,
  pieceTargetTempo,
  onSectionClick,
  onStatusCycle,
}: {
  section: PieceSection;
  leftPct: number;
  widthPct: number;
  isActive: boolean;
  startSeconds: number;
  pieceTargetTempo: number | null;
  onSectionClick: () => void;
  onStatusCycle?: () => void;
}) {
  const video = useVideo();
  const metronome = useMetronome();
  const [open, setOpen] = useState(false);

  const effectiveTempo = section.target_tempo ?? pieceTargetTempo;
  const sectionPracticeTempo = practiceTempo(section.status, effectiveTempo);

  const handlePlayPause = () => {
    // Seek to section start first
    video.seekTo(startSeconds);
    if (video.isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleMetronomeStart = () => {
    const tempo = sectionPracticeTempo ?? effectiveTempo;
    if (tempo) {
      if (metronome.isActive && metronome.bpm === tempo) {
        metronome.stop();
      } else {
        metronome.start(tempo);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) {
        onSectionClick();
      }
    }}>
      <PopoverTrigger
        className={cn(
          "absolute top-0 h-full flex items-center justify-start overflow-hidden transition-opacity cursor-pointer hover:opacity-90",
          SECTION_STATUS_COLORS[section.status],
          isActive && "ring-1 ring-inset ring-foreground/30"
        )}
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
        }}
      >
        <span className={cn(
          "text-[8px] leading-none font-medium pointer-events-none select-none pl-0.5",
          SECTION_SCRUBBER_TEXT_COLORS[section.status]
        )}>
          {section.label}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-auto p-2 bg-foreground text-background ring-foreground/20"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {onStatusCycle && (
              <button onClick={onStatusCycle} className="shrink-0">
                <CircleIcon
                  className={cn(
                    "size-3 fill-current",
                    SECTION_STATUS_DOT_COLORS[section.status]
                  )}
                />
              </button>
            )}
            <span className="text-sm font-medium">{section.label}</span>
            <span className="text-xs opacity-60">
              {SECTION_STATUS_LABELS[section.status]}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Play/Pause video at this section */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background"
              onClick={handlePlayPause}
            >
              {video.isPlaying ? (
                <PauseIcon className="size-3" />
              ) : (
                <PlayIcon className="size-3" />
              )}
              {video.isPlaying ? "Pause" : "Play"}
            </Button>

            {/* Metronome at practice tempo (or target tempo if not started) */}
            {(sectionPracticeTempo || effectiveTempo) && (
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 gap-1 font-mono tabular-nums",
                  metronome.isActive && metronome.bpm === (sectionPracticeTempo ?? effectiveTempo)
                    ? "bg-background text-foreground hover:bg-background/90 hover:text-foreground"
                    : "border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background"
                )}
                onClick={handleMetronomeStart}
              >
                ♩ {sectionPracticeTempo ?? effectiveTempo}
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
