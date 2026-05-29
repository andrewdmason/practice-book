"use client";

import { useCallback, useRef, useState } from "react";
import { Play, Pause, PlusIcon } from "lucide-react";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMetronome } from "@/components/metronome/metronome-context";
import { useVideo } from "@/components/video/video-context";
import {
  updateSectionStatus,
  updateSectionName,
  updateSectionNotes,
  updateSectionTargetTempo,
} from "@/app/practice/repertoire/section-actions";
import type {
  PieceSectionWithChildren,
  PieceSection,
  SectionStatus,
} from "@/lib/types";
import {
  SECTION_STATUS_COLORS,
  SECTION_STATUS_TEXT_COLORS,
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
  onStatusChange,
  onAddTask,
}: {
  sections: PieceSectionWithChildren[];
  pieceTargetTempo: number | null;
  pieceId: string;
  pieceName: string;
  composer: string | null;
  onSectionsChanged: () => void;
  onStatusChange?: (sectionId: string, status: SectionStatus) => void;
  onAddTask?: (section: PieceSection, metronomeSpeed: number | null, tomorrow?: boolean) => void;
}) {
  const allSections = flattenSections(sections);
  const video = useVideo();

  // Determine which section is currently playing by finding the last section
  // whose start_seconds <= currentTime
  const playingSectionId = (() => {
    if (!video.isPlaying) return null;
    let best: { sectionId: string; start: number } | null = null;
    for (const ts of video.timestamps) {
      if (ts.start_seconds <= video.currentTime) {
        if (!best || ts.start_seconds > best.start) {
          best = { sectionId: ts.section_id, start: ts.start_seconds };
        }
      }
    }
    return best?.sectionId ?? null;
  })();

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
            onStatusChange={onStatusChange}
            onAddTask={onAddTask}
            isFirst={i === 0}
            isLast={i === allSections.length - 1}
            playingSectionId={playingSectionId}
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
  onSectionsChanged,
  onStatusChange,
  onAddTask,
  isFirst,
  isLast,
  playingSectionId,
}: {
  section: PieceSection;
  pieceTargetTempo: number | null;
  pieceId: string;
  pieceName: string;
  composer: string | null;
  onSectionsChanged: () => void;
  onStatusChange?: (sectionId: string, status: SectionStatus) => void;
  onAddTask?: (section: PieceSection, metronomeSpeed: number | null, tomorrow?: boolean) => void;
  isFirst: boolean;
  isLast: boolean;
  playingSectionId: string | null;
}) {
  const { start: startMetronome, isActive: metronomeActive } = useMetronome();
  const video = useVideo();

  const effectiveTempo = section.target_tempo ?? pieceTargetTempo;
  const tempo = practiceTempo(section.status, effectiveTempo);

  const isActiveSection = false; // No session-level section tracking anymore

  const handleStatusCycle = (reverse = false) => {
    const next = (reverse
      ? ((section.status + 8) % 9)
      : ((section.status + 1) % 9)) as SectionStatus;
    onStatusChange?.(section.id, next);
    updateSectionStatus(section.id, next, { pieceId });
    window.dispatchEvent(new CustomEvent("section-status-changed", { detail: { sectionId: section.id, status: next } }));
    if (metronomeActive) {
      const newTempo = practiceTempo(next, effectiveTempo);
      if (newTempo) startMetronome(newTempo);
    }
  };

  const handlePracticeTempoClick = () => {
    if (!tempo) return;
    startMetronome(tempo);
  };

  // ---------------- Notes editor (mirrors task-row pattern) ----------------
  const noteInputRef = useRef<HTMLInputElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(section.notes ?? "");
  const [prevServerNotes, setPrevServerNotes] = useState(section.notes ?? "");
  const serverNotes = section.notes ?? "";
  if (serverNotes !== prevServerNotes) {
    setPrevServerNotes(serverNotes);
    if (!noteOpen) setNoteText(serverNotes);
  }

  const autoGrowNote = useCallback(() => {
    const el = noteTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const isNoteOverflowing = useCallback(() => {
    const el = noteInputRef.current;
    if (!el) return false;
    return el.scrollWidth > el.clientWidth;
  }, []);

  const openNotePopover = useCallback(() => {
    setNoteOpen(true);
    requestAnimationFrame(() => {
      const el = noteTextareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      autoGrowNote();
    });
  }, [autoGrowNote]);

  const persistNotes = (value: string) => {
    if (value === serverNotes) return;
    void updateSectionNotes(section.id, value.trim() ? value : null);
  };

  const handleNoteOpenChange = (open: boolean) => {
    if (!open) {
      persistNotes(noteText);
      setNoteOpen(false);
    }
  };

  const handleInlineNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNoteText(e.target.value);
    requestAnimationFrame(() => {
      if (isNoteOverflowing()) openNotePopover();
    });
  };

  const handleInlineNoteClick = () => {
    if (isNoteOverflowing()) openNotePopover();
  };

  const handleInlineNoteBlur = () => {
    if (noteOpen) return;
    persistNotes(noteText);
  };

  const handleInlineNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  // ---------------- Edit dialogs ----------------
  const [titleDialogOpen, setTitleDialogOpen] = useState(false);
  const [titleValue, setTitleValue] = useState(section.name ?? "");
  const [tempoDialogOpen, setTempoDialogOpen] = useState(false);
  const [tempoDialogValue, setTempoDialogValue] = useState(
    section.target_tempo !== null ? String(section.target_tempo) : ""
  );

  const openTitleDialog = () => {
    setTitleValue(section.name ?? "");
    setTitleDialogOpen(true);
  };

  const openTempoDialog = () => {
    setTempoDialogValue(
      section.target_tempo !== null ? String(section.target_tempo) : ""
    );
    setTempoDialogOpen(true);
  };

  const handleSaveTitle = async () => {
    const trimmed = titleValue.trim();
    await updateSectionName(section.id, trimmed ? trimmed : null);
    setTitleDialogOpen(false);
    onSectionsChanged();
  };

  const handleSaveTempoDialog = async () => {
    const parsed = tempoDialogValue.trim()
      ? parseInt(tempoDialogValue, 10)
      : null;
    const value = parsed && !isNaN(parsed) ? parsed : null;
    await updateSectionTargetTempo(section.id, value);
    setTempoDialogOpen(false);
    onSectionsChanged();
  };

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger
        render={
          <div
            className={cn(
              "group/row flex items-center gap-0 transition-colors rounded-sm",
              isActiveSection && "bg-primary/10"
            )}
          />
        }
      >
        {/* Add task button — visible on hover, next to label */}
        {onAddTask && (
          <button
            onClick={(e) => onAddTask(section, tempo, e.altKey)}
            className="shrink-0 opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-foreground transition-opacity mr-1"
            title="Add task for this section (⌥-click for tomorrow)"
          >
            <PlusIcon className="size-3" />
          </button>
        )}

        {/* Play/pause video toggle */}
        {(() => {
          const ts = video.timestamps.find((t) => t.section_id === section.id);
          if (!ts) return <span className="shrink-0 w-4 mr-1" />;
          const isThisSectionPlaying = playingSectionId === section.id;
          return (
            <button
              onClick={() => {
                if (isThisSectionPlaying) {
                  video.pause();
                } else {
                  if (!video.showVideo) video.setShowVideo(true);
                  video.seekTo(ts.start_seconds);
                  video.play();
                }
              }}
              className={cn(
                "shrink-0 w-4 h-4 flex items-center justify-center cursor-pointer transition-colors mr-1",
                isThisSectionPlaying
                  ? "text-primary"
                  : "text-muted-foreground/40 hover:text-foreground"
              )}
            >
              {isThisSectionPlaying ? (
                <Pause className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
            </button>
          );
        })()}

        {/* Status color square with section letter — tooltip shows section name.
            Left-click: cycle forward. Option(alt)+click: cycle backward. */}
        {section.name ? (
          <Tooltip>
            <TooltipTrigger
              onClick={(e) => handleStatusCycle(e.altKey)}
              className={cn(
                "w-7 h-6 shrink-0 flex items-center justify-center text-xs font-medium tabular-nums transition-colors cursor-pointer hover:opacity-80",
                SECTION_STATUS_COLORS[section.status],
                SECTION_STATUS_TEXT_COLORS[section.status],
                isFirst && "rounded-t-sm",
                isLast && "rounded-b-sm"
              )}
            >
              {section.label}
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="text-xs">{section.name}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={(e) => handleStatusCycle(e.altKey)}
            className={cn(
              "w-7 h-6 shrink-0 flex items-center justify-center text-xs font-medium tabular-nums transition-colors cursor-pointer hover:opacity-80",
              SECTION_STATUS_COLORS[section.status],
              SECTION_STATUS_TEXT_COLORS[section.status],
              isFirst && "rounded-t-sm",
              isLast && "rounded-b-sm"
            )}
          >
            {section.label}
          </button>
        )}

        {/* Practice tempo pill */}
        <div className="ml-1.5 shrink-0">
          {tempo ? (
            <button
              onClick={handlePracticeTempoClick}
              className="inline-flex items-center rounded-md bg-secondary px-1 py-0.5 font-mono text-xs text-secondary-foreground cursor-pointer hover:bg-secondary/80 transition-colors"
            >
              ♩={tempo}
            </button>
          ) : (
            <span className="text-[10px] text-muted-foreground/40 font-mono px-1">
              —
            </span>
          )}
        </div>

        {/* Notes — fills remaining space, inline editable, opens popover when overflowing */}
        <div className="ml-1.5 flex-1 min-w-0 flex items-center">
          <Popover open={noteOpen} onOpenChange={handleNoteOpenChange}>
            <input
              ref={noteInputRef}
              type="text"
              value={noteText}
              onChange={handleInlineNoteChange}
              onClick={handleInlineNoteClick}
              onBlur={handleInlineNoteBlur}
              onKeyDown={handleInlineNoteKeyDown}
              onContextMenu={(e) => e.stopPropagation()}
              placeholder="Notes..."
              className={cn(
                "block w-full min-w-0 bg-transparent text-left text-xs leading-tight focus:outline-none cursor-text text-ellipsis",
                noteText
                  ? "text-muted-foreground placeholder:text-muted-foreground/50"
                  : "text-muted-foreground placeholder:text-muted-foreground/40"
              )}
            />
            <PopoverContent
              anchor={noteInputRef}
              align="start"
              side="bottom"
              sideOffset={-22}
              className="min-w-[260px] max-w-[480px] p-2 gap-0"
            >
              <textarea
                ref={noteTextareaRef}
                value={noteText}
                onChange={(e) => {
                  setNoteText(e.target.value);
                  autoGrowNote();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    handleNoteOpenChange(false);
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleNoteOpenChange(false);
                  }
                }}
                placeholder="Notes..."
                rows={1}
                className="w-full bg-transparent focus:outline-none resize-none leading-tight text-xs text-foreground placeholder:text-muted-foreground/50"
              />
            </PopoverContent>
          </Popover>
        </div>
      </ContextMenuPrimitive.Trigger>

      {/* Right-click context menu */}
      <DropdownMenuContent side="bottom" align="start" className="w-48">
        <DropdownMenuItem onClick={openTitleDialog}>Edit title</DropdownMenuItem>
        <DropdownMenuItem onClick={openTempoDialog}>
          Edit target tempo
        </DropdownMenuItem>
      </DropdownMenuContent>

      {/* Edit title dialog */}
      <Dialog open={titleDialogOpen} onOpenChange={setTitleDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit title — Section {section.label}</DialogTitle>
          </DialogHeader>
          <Input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSaveTitle();
              }
            }}
            placeholder="Section title"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTitleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveTitle()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit target tempo dialog */}
      <Dialog open={tempoDialogOpen} onOpenChange={setTempoDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Edit target tempo — Section {section.label}
            </DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            min={20}
            max={300}
            value={tempoDialogValue}
            onChange={(e) => setTempoDialogValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSaveTempoDialog();
              }
            }}
            placeholder="e.g. 120"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTempoDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveTempoDialog()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContextMenuPrimitive.Root>
  );
}
