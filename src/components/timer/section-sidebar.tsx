"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTimer } from "@/components/timer/timer-context";
import { useMetronome } from "@/components/metronome/metronome-context";
import {
  updateSectionStatus,
  updateSectionTargetTempo,
} from "@/app/(app)/repertoire/section-actions";
import type {
  PieceSectionWithChildren,
  PieceSection,
  SectionStatus,
} from "@/lib/types";
import {
  SECTION_STATUS_LABELS,
  SECTION_STATUS_COLORS,
  SECTION_STATUS_PERCENTAGE,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { practiceTempo, flattenSections } from "@/lib/section-utils";

export function SectionSidebar({
  sections,
  pieceTargetTempo,
  pieceId,
  pieceName,
  composer,
  onSectionsChanged,
}: {
  sections: PieceSectionWithChildren[];
  pieceTargetTempo: number | null;
  pieceId: string;
  pieceName: string;
  composer: string | null;
  onSectionsChanged: () => void;
}) {
  const allSections = flattenSections(sections);
  if (allSections.length === 0) return null;

  return (
    <div>
      <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        Sections
      </h4>
      <div className="flex flex-col">
        {allSections.map((section, i) => (
          <SectionRow
            key={section.id}
            section={section}
            pieceTargetTempo={pieceTargetTempo}
            pieceId={pieceId}
            pieceName={pieceName}
            composer={composer}
            onSectionsChanged={onSectionsChanged}
            isFirst={i === 0}
            isLast={i === allSections.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function SectionRow({
  section,
  pieceTargetTempo,
  pieceId,
  pieceName,
  composer,
  onSectionsChanged,
  isFirst,
  isLast,
}: {
  section: PieceSection;
  pieceTargetTempo: number | null;
  pieceId: string;
  pieceName: string;
  composer: string | null;
  onSectionsChanged: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { isRunning, currentTarget, focusedTarget, setFocusedTarget, startTimer, switchTarget, stopTimer } = useTimer();
  const { start: startMetronome } = useMetronome();
  const [editingTempo, setEditingTempo] = useState(false);
  const [tempoValue, setTempoValue] = useState(
    String(section.target_tempo ?? "")
  );
  const clickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveTempo = section.target_tempo ?? pieceTargetTempo;
  const tempo = practiceTempo(section.status, effectiveTempo);

  const sectionTarget = {
    category: "piece" as const,
    pieceId,
    pieceName,
    composer,
    sectionId: section.id,
    sectionLabel: section.label,
  };

  const isActiveSection =
    (isRunning && currentTarget?.category === "piece" && currentTarget.sectionId === section.id) ||
    (!isRunning && focusedTarget?.category === "piece" && focusedTarget.sectionId === section.id);

  const handleLabelClick = () => {
    // Delay single-click to avoid firing before double-click
    if (clickTimeout.current) clearTimeout(clickTimeout.current);
    clickTimeout.current = setTimeout(() => {
      if (isRunning) {
        if (currentTarget?.category === "piece" && currentTarget.sectionId === section.id) {
          switchTarget({ category: "piece", pieceId, pieceName, composer });
        } else {
          switchTarget(sectionTarget);
        }
      } else {
        if (focusedTarget?.category === "piece" && focusedTarget.sectionId === section.id) {
          setFocusedTarget({ category: "piece", pieceId, pieceName, composer });
        } else {
          setFocusedTarget(sectionTarget);
        }
      }
    }, 200);
  };

  const handleLabelDoubleClick = () => {
    if (clickTimeout.current) clearTimeout(clickTimeout.current);
    if (isRunning) {
      stopTimer();
    } else {
      startTimer(sectionTarget);
    }
  };

  const handleStatusCycle = async () => {
    const next = ((section.status + 1) % 6) as SectionStatus;
    await updateSectionStatus(section.id, next);
    onSectionsChanged();
  };

  const handlePracticeTempoClick = () => {
    if (!tempo) return;
    if (isRunning) {
      switchTarget(sectionTarget);
    } else {
      startTimer(sectionTarget);
    }
    startMetronome(tempo);
  };

  const handleSaveTempo = async () => {
    setEditingTempo(false);
    const parsed = tempoValue.trim() ? parseInt(tempoValue, 10) : null;
    const value = parsed && !isNaN(parsed) ? parsed : null;
    await updateSectionTargetTempo(section.id, value);
    onSectionsChanged();
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0 transition-colors rounded-sm",
        isActiveSection && "bg-primary/10"
      )}
    >
      {/* Label */}
      <button
        onClick={handleLabelClick}
        onDoubleClick={handleLabelDoubleClick}
        className={cn(
          "text-xs font-medium w-8 shrink-0 text-left cursor-pointer transition-colors",
          isActiveSection
            ? "text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {section.label}
      </button>

      {/* Status color square — continuous column, no vertical gap */}
      <Tooltip>
        <TooltipTrigger
          onClick={handleStatusCycle}
          className={cn(
            "w-5 h-6 shrink-0 transition-colors cursor-pointer hover:opacity-80",
            SECTION_STATUS_COLORS[section.status],
            isFirst && "rounded-t-sm",
            isLast && "rounded-b-sm"
          )}
        />
        <TooltipContent side="left">
          <p className="text-xs">{SECTION_STATUS_LABELS[section.status]}</p>
        </TooltipContent>
      </Tooltip>

      {/* Practice tempo pill + percentage */}
      <div className="ml-1.5 shrink-0 flex items-center gap-1">
        {tempo ? (
          <>
            <button
              onClick={handlePracticeTempoClick}
              className="inline-flex items-center rounded-md bg-secondary px-1 py-0.5 font-mono text-xs text-secondary-foreground cursor-pointer hover:bg-secondary/80 transition-colors"
            >
              ♩={tempo}
            </button>
            <span className="text-[10px] text-muted-foreground/50 font-mono">
              ({Math.round(SECTION_STATUS_PERCENTAGE[section.status] * 100)}%)
            </span>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground/40 font-mono px-1">
            —
          </span>
        )}
      </div>

      {/* Target tempo — click to edit, right-aligned */}
      <div className="flex-1 flex justify-end">
        {editingTempo ? (
          <Input
            type="number"
            value={tempoValue}
            onChange={(e) => setTempoValue(e.target.value)}
            onBlur={handleSaveTempo}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveTempo();
              if (e.key === "Escape") {
                setEditingTempo(false);
                setTempoValue(String(section.target_tempo ?? ""));
              }
            }}
            className="h-5 w-12 text-[10px] px-1"
            autoFocus
            min={20}
            max={300}
          />
        ) : (
          <button
            onClick={() => {
              setTempoValue(String(section.target_tempo ?? ""));
              setEditingTempo(true);
            }}
            className={cn(
              "text-[10px] font-mono tabular-nums hover:text-foreground transition-colors",
              section.target_tempo
                ? "text-muted-foreground"
                : "text-muted-foreground/50"
            )}
          >
            {effectiveTempo ? `♩${effectiveTempo}` : "—"}
          </button>
        )}
      </div>
    </div>
  );
}
