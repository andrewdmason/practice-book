"use client";

import { useCallback, useState } from "react";
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
import { TimeEditDialog } from "@/components/feed/time-edit-dialog";
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

export function FeedSection({ section, isToday, pieces, timeSeconds, hasTimeOverride, editorContext = "practice_entry" }: FeedSectionProps) {
  const sectionHasContent = hasContent(section.content);
  const [isOpen, setIsOpen] = useState(sectionHasContent);
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false);
  const [optimisticTime, setOptimisticTime] = useState<number | null | undefined>(undefined);

  const displayTime = optimisticTime !== undefined ? optimisticTime : timeSeconds;

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
    setIsTimeDialogOpen(true);
  };

  const handleTimeSave = useCallback(
    (seconds: number | null) => {
      setIsTimeDialogOpen(false);
      setOptimisticTime(seconds);
      updateSectionTime(section.id, seconds);
    },
    [section.id]
  );

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
        <span
          className={cn(
            "ml-auto shrink-0 text-xs tabular-nums",
            section.category !== "general" && "cursor-pointer hover:text-foreground",
            hasTimeOverride || optimisticTime !== undefined
              ? "text-foreground/70"
              : "text-muted-foreground/50"
          )}
          onClick={section.category !== "general" ? handleTimeClick : undefined}
          title={section.category !== "general" ? "Click to edit time" : undefined}
        >
          {displayTime != null && displayTime > 0
            ? formatElapsed(displayTime)
            : !sectionHasContent
              ? "empty"
              : null}
        </span>
      </CollapsibleTrigger>
      {section.category !== "general" && (
        <TimeEditDialog
          open={isTimeDialogOpen}
          onOpenChange={setIsTimeDialogOpen}
          timeSeconds={displayTime ?? undefined}
          onSave={handleTimeSave}
        />
      )}
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
