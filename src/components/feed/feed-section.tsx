"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { ChevronRightIcon, MusicIcon, BookOpenIcon, PenLineIcon, MessageSquareIcon } from "lucide-react";
import type { JSONContent } from "@tiptap/core";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { saveEditorContent } from "@/app/(app)/editor/actions";
import { updateSectionTime } from "@/app/(app)/feed/actions";
import { formatElapsed } from "@/lib/timer-utils";
import type { PracticeEntrySection, PieceSuggestion } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  technique: "Technique",
  sight_reading: "Sight Reading",
  general: "General Notes",
};

const CATEGORY_ICONS: Record<string, typeof MusicIcon> = {
  piece: MusicIcon,
  technique: BookOpenIcon,
  sight_reading: BookOpenIcon,
  general: PenLineIcon,
};

function hasContent(content: unknown): boolean {
  if (!content) return false;
  const doc = content as { content?: { type: string }[] };
  if (!doc.content || doc.content.length === 0) return false;
  // A single empty paragraph doesn't count
  if (
    doc.content.length === 1 &&
    doc.content[0].type === "paragraph" &&
    !("content" in doc.content[0])
  ) {
    return false;
  }
  return true;
}

type FeedSectionProps = {
  section: PracticeEntrySection;
  isToday: boolean;
  pieces: PieceSuggestion[];
  timeSeconds?: number;
  hasTimeOverride?: boolean;
  editorContext?: "practice_entry" | "lesson";
};

function secondsToMinutes(s: number): string {
  return String(Math.round(s / 60));
}

function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Support "HH:MM:SS", "MM:SS", or just minutes
  const colonParts = trimmed.split(":");
  if (colonParts.length === 3) {
    const [h, m, s] = colonParts.map(Number);
    if ([h, m, s].some(isNaN)) return null;
    return h * 3600 + m * 60 + s;
  }
  if (colonParts.length === 2) {
    const [m, s] = colonParts.map(Number);
    if ([m, s].some(isNaN)) return null;
    return m * 60 + s;
  }
  const mins = Number(trimmed);
  if (isNaN(mins) || mins < 0) return null;
  return Math.round(mins * 60);
}

export function FeedSection({ section, isToday, pieces, timeSeconds, hasTimeOverride, editorContext = "practice_entry" }: FeedSectionProps) {
  const sectionHasContent = hasContent(section.content);
  const [isOpen, setIsOpen] = useState(sectionHasContent);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeInputValue, setTimeInputValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const timeInputRef = useRef<HTMLInputElement>(null);

  const label =
    section.category === "piece"
      ? section.piece_name ?? "Unknown Piece"
      : CATEGORY_LABELS[section.category] ?? section.category;

  const subtitle =
    section.category === "piece" ? section.composer : null;

  const Icon = CATEGORY_ICONS[section.category] ?? MessageSquareIcon;

  const handleSave = useCallback(
    async (content: JSONContent) => {
      await saveEditorContent("practice_entry", section.id, content);
    },
    [section.id]
  );

  const handleTimeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (section.category === "general") return;
    setTimeInputValue(timeSeconds ? secondsToMinutes(timeSeconds) : "");
    setIsEditingTime(true);
    setTimeout(() => timeInputRef.current?.select(), 0);
  };

  const handleTimeSave = () => {
    setIsEditingTime(false);
    const newSeconds = parseTimeInput(timeInputValue);
    // If input was empty or 0, clear the override
    const valueToSave = newSeconds === null || newSeconds === 0 ? null : newSeconds;
    startTransition(async () => {
      await updateSectionTime(section.id, valueToSave);
    });
  };

  const handleTimeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTimeSave();
    } else if (e.key === "Escape") {
      setIsEditingTime(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
          isOpen && "bg-muted/30"
        )}
      >
        <ChevronRightIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-90"
          )}
        />
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium truncate">{label}</span>
        {subtitle && (
          <span className="text-muted-foreground truncate text-xs">
            {subtitle}
          </span>
        )}
        {isEditingTime ? (
          <span
            className="ml-auto shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={timeInputRef}
              type="text"
              value={timeInputValue}
              onChange={(e) => setTimeInputValue(e.target.value)}
              onBlur={handleTimeSave}
              onKeyDown={handleTimeKeyDown}
              placeholder="min"
              className="w-14 rounded border bg-background px-1.5 py-0.5 text-xs tabular-nums text-right focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </span>
        ) : (
          <span
            className={cn(
              "ml-auto shrink-0 text-xs tabular-nums",
              section.category !== "general" && "cursor-pointer hover:text-foreground",
              hasTimeOverride
                ? "text-foreground/70"
                : "text-muted-foreground/50"
            )}
            onClick={section.category !== "general" ? handleTimeClick : undefined}
            title={section.category !== "general" ? "Click to edit time" : undefined}
          >
            {isPending
              ? "..."
              : timeSeconds != null && timeSeconds > 0
                ? formatElapsed(timeSeconds)
                : !sectionHasContent
                  ? "empty"
                  : null}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-9 pr-3 pb-3 pt-1">
          {isToday ? (
            <RichTextEditor
              context={editorContext}
              sourceType="practice_entry"
              sourceId={section.id}
              initialContent={section.content as JSONContent | null}
              pieces={pieces}
              onSave={handleSave}
              placeholder="Write your notes..."
            />
          ) : sectionHasContent ? (
            <RichTextEditor
              context={editorContext}
              sourceType="practice_entry"
              sourceId={section.id}
              initialContent={section.content as JSONContent | null}
              pieces={pieces}
              readOnly
            />
          ) : (
            <p className="text-sm text-muted-foreground/50 italic">
              No notes recorded
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
