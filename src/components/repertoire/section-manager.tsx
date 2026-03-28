"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getSections,
  createSection,
  updateSectionStatus,
  updateSectionTargetTempo,
  updatePieceTargetTempo,
  deleteSection,
} from "@/app/(app)/repertoire/section-actions";
import type {
  PieceSectionWithChildren,
  PieceSection,
  SectionStatus,
} from "@/lib/types";
import {
  SECTION_STATUS_LABELS,
  SECTION_STATUS_DOT_COLORS,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function nextSectionLetter(sections: PieceSectionWithChildren[]): string {
  if (sections.length === 0) return "A";
  const letters = sections.map((s) => s.label);
  const lastLetter = letters[letters.length - 1];
  return String.fromCharCode(lastLetter.charCodeAt(0) + 1);
}

function nextSubsectionLabel(parent: PieceSectionWithChildren): string {
  const num = parent.children.length + 1;
  return `${parent.label}${num}`;
}

export function SectionManager({
  pieceId,
  pieceTargetTempo,
  initialSections,
}: {
  pieceId: string;
  pieceTargetTempo: number | null;
  initialSections: PieceSectionWithChildren[];
}) {
  const [sections, setSections] = useState(initialSections);
  const [targetTempo, setTargetTempo] = useState(pieceTargetTempo);
  const [editingTempo, setEditingTempo] = useState(false);
  const [tempoValue, setTempoValue] = useState(
    String(pieceTargetTempo ?? "")
  );

  const refresh = useCallback(() => {
    getSections(pieceId).then(setSections);
  }, [pieceId]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("sections-changed", handler);
    return () => window.removeEventListener("sections-changed", handler);
  }, [refresh]);

  const handleAddSection = async () => {
    const label = nextSectionLetter(sections);
    await createSection(pieceId, label);
    refresh();
    window.dispatchEvent(new CustomEvent("sections-changed"));
  };

  const handleAddSubsection = async (parent: PieceSectionWithChildren) => {
    const label = nextSubsectionLabel(parent);
    await createSection(pieceId, label, parent.id);
    refresh();
    window.dispatchEvent(new CustomEvent("sections-changed"));
  };

  const handleDelete = async (sectionId: string) => {
    setSections((prev) =>
      prev
        .filter((s) => s.id !== sectionId)
        .map((s) => ({
          ...s,
          children: s.children.filter((c) => c.id !== sectionId),
        }))
    );
    await deleteSection(sectionId);
    window.dispatchEvent(new CustomEvent("sections-changed"));
  };

  const handleStatusCycle = (section: PieceSection) => {
    const next = ((section.status + 1) % 6) as SectionStatus;
    // Optimistic update
    setSections((prev) =>
      prev.map((s) => {
        if (s.id === section.id) return { ...s, status: next };
        return {
          ...s,
          children: s.children.map((c) =>
            c.id === section.id ? { ...c, status: next } : c
          ),
        };
      })
    );
    updateSectionStatus(section.id, next);
    window.dispatchEvent(new CustomEvent("sections-changed"));
  };

  const handleSavePieceTempo = () => {
    setEditingTempo(false);
    const parsed = tempoValue.trim() ? parseInt(tempoValue, 10) : null;
    const value = parsed && !isNaN(parsed) ? parsed : null;
    setTargetTempo(value);
    updatePieceTargetTempo(pieceId, value);
    window.dispatchEvent(new CustomEvent("sections-changed"));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Sections</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Target tempo:</span>
          {editingTempo ? (
            <Input
              type="number"
              value={tempoValue}
              onChange={(e) => setTempoValue(e.target.value)}
              onBlur={handleSavePieceTempo}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePieceTempo();
                if (e.key === "Escape") {
                  setEditingTempo(false);
                  setTempoValue(String(targetTempo ?? ""));
                }
              }}
              className="w-20 h-7 text-xs"
              autoFocus
              min={20}
              max={300}
            />
          ) : (
            <button
              onClick={() => {
                setTempoValue(String(targetTempo ?? ""));
                setEditingTempo(true);
              }}
              className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
            >
              {targetTempo ? `♩ ${targetTempo}` : "Set..."}
            </button>
          )}
        </div>
      </div>

      {sections.length > 0 && (
        <div className="space-y-1">
          {sections.map((section) => (
            <div key={section.id}>
              <SectionRow
                section={section}
                pieceTargetTempo={targetTempo}
                onStatusCycle={() => handleStatusCycle(section)}
                onDelete={() => handleDelete(section.id)}
                onTempoChange={(tempo) => {
                  setSections((prev) =>
                    prev.map((s) =>
                      s.id === section.id
                        ? { ...s, target_tempo: tempo }
                        : s
                    )
                  );
                  updateSectionTargetTempo(section.id, tempo);
                  window.dispatchEvent(new CustomEvent("sections-changed"));
                }}
                isBare={section.children.length === 0}
              />
              {section.children.map((child) => (
                <SectionRow
                  key={child.id}
                  section={child}
                  pieceTargetTempo={targetTempo}
                  onStatusCycle={() => handleStatusCycle(child)}
                  onDelete={() => handleDelete(child.id)}
                  onTempoChange={(tempo) => {
                    setSections((prev) =>
                      prev.map((s) => ({
                        ...s,
                        children: s.children.map((c) =>
                          c.id === child.id
                            ? { ...c, target_tempo: tempo }
                            : c
                        ),
                      }))
                    );
                    updateSectionTargetTempo(child.id, tempo);
                    window.dispatchEvent(new CustomEvent("sections-changed"));
                  }}
                  isChild
                />
              ))}
              <button
                onClick={() => handleAddSubsection(section)}
                className="ml-8 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
              >
                + subsection
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleAddSection}
        className="mt-3"
      >
        <PlusIcon className="size-3.5 mr-1" />
        Add Section
      </Button>
    </div>
  );
}

function SectionRow({
  section,
  pieceTargetTempo,
  onStatusCycle,
  onDelete,
  onTempoChange,
  isChild,
  isBare,
}: {
  section: PieceSection;
  pieceTargetTempo: number | null;
  onStatusCycle: () => void;
  onDelete: () => void;
  onTempoChange: (tempo: number | null) => void;
  isChild?: boolean;
  isBare?: boolean;
}) {
  const [editingTempo, setEditingTempo] = useState(false);
  const effectiveTempo = section.target_tempo ?? pieceTargetTempo;
  const [tempoValue, setTempoValue] = useState(
    String(section.target_tempo ?? "")
  );

  const handleSaveTempo = () => {
    setEditingTempo(false);
    const parsed = tempoValue.trim() ? parseInt(tempoValue, 10) : null;
    const value = parsed && !isNaN(parsed) ? parsed : null;
    onTempoChange(value);
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 transition-colors",
        isChild && "ml-6"
      )}
    >
      <Tooltip>
        <TooltipTrigger onClick={onStatusCycle} className="shrink-0">
          <CircleIcon
            className={cn(
              "size-3 fill-current",
              SECTION_STATUS_DOT_COLORS[section.status]
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">{SECTION_STATUS_LABELS[section.status]}</p>
        </TooltipContent>
      </Tooltip>

      <span className="text-sm font-medium min-w-[2rem]">
        {section.label}
      </span>

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
          className="w-16 h-6 text-xs"
          autoFocus
          min={20}
          max={300}
          placeholder={effectiveTempo ? String(effectiveTempo) : "—"}
        />
      ) : (
        <button
          onClick={() => {
            setTempoValue(String(section.target_tempo ?? ""));
            setEditingTempo(true);
          }}
          className={cn(
            "text-xs font-mono tabular-nums px-1 py-0.5 rounded hover:bg-muted transition-colors",
            section.target_tempo ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {section.target_tempo
            ? `♩ ${section.target_tempo}`
            : effectiveTempo
              ? `♩ ${effectiveTempo}`
              : "—"}
        </button>
      )}

      <div className="flex-1" />

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}
