"use client";

import { useCallback, useState } from "react";
import { NotebookPenIcon, ClockIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import dynamic from "next/dynamic";
import type { JSONContent } from "@tiptap/core";

const RichTextEditor = dynamic(
  () =>
    import("@/components/editor/rich-text-editor").then(
      (m) => m.RichTextEditor
    ),
  { ssr: false }
);
import { saveEditorContent } from "@/app/(app)/editor/actions";
import { updateSectionTime, deleteSection } from "@/app/(app)/feed/actions";
import { formatMinutes } from "@/lib/timer-utils";
import { TimeEditDialog } from "@/components/feed/time-edit-dialog";
import type { PracticeEntrySection, PieceSuggestion } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  technique: "Technique",
  sight_reading: "Sight Reading",
  general: "General Notes",
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
  isActive?: boolean;
  pieces: PieceSuggestion[];
  timeSeconds?: number;
  hasTimeOverride?: boolean;
  editorContext?: "practice_entry" | "lesson";
};

export function FeedSection({ section, isToday, isActive, pieces, timeSeconds, hasTimeOverride, editorContext = "practice_entry" }: FeedSectionProps) {
  const sectionHasContent = hasContent(section.content);
  const [isEditorVisible, setIsEditorVisible] = useState(sectionHasContent);
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false);
  const [optimisticTime, setOptimisticTime] = useState<number | null | undefined>(undefined);
  const [isDeleted, setIsDeleted] = useState(false);

  const displayTime = optimisticTime !== undefined ? optimisticTime : timeSeconds;

  const label =
    section.category === "piece"
      ? section.piece_name ?? "Unknown Piece"
      : CATEGORY_LABELS[section.category] ?? section.category;

  const subtitle =
    section.category === "piece" ? section.composer : null;

  const handleSave = useCallback(
    async (content: JSONContent) => {
      await saveEditorContent("practice_entry", section.id, content);
      window.dispatchEvent(new CustomEvent("tasks-changed"));
    },
    [section.id]
  );

  const handleDelete = useCallback(() => {
    setIsDeleted(true);
    deleteSection(section.id);
  }, [section.id]);

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

  if (isDeleted) return null;

  // Hide piece sections with no time, no content, and not actively being timed —
  // but only on today's entry where sections are auto-created for all active pieces.
  // Past entries only have sections for pieces that were practiced or manually added.
  if (
    isToday &&
    section.category === "piece" &&
    !sectionHasContent &&
    (displayTime == null || displayTime <= 0) &&
    !isActive
  ) {
    return null;
  }

  const hideHeader = section.category === "general" && editorContext === "lesson";

  return (
    <div className="group/section">
      {!hideHeader && (
        <div
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm"
        >
          <span className="font-medium truncate">{label}</span>
          {subtitle && (
            <span className="text-muted-foreground truncate text-xs">
              {subtitle}
            </span>
          )}
          {displayTime != null && displayTime > 0 ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs tabular-nums font-medium whitespace-nowrap",
                isActive
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-muted text-muted-foreground",
                section.category !== "general" && "cursor-pointer"
              )}
              onClick={section.category !== "general" ? handleTimeClick : undefined}
              title={section.category !== "general" ? "Click to edit time" : undefined}
            >
              <ClockIcon className="size-3 shrink-0" />
              {formatMinutes(displayTime)}
            </span>
          ) : !sectionHasContent ? (
            <span className="shrink-0 text-xs text-muted-foreground/50">empty</span>
          ) : null}
          {!isEditorVisible && (
            <button
              type="button"
              onClick={() => setIsEditorVisible(true)}
              className="ml-1 shrink-0 opacity-0 group-hover/section:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              title="Add notes"
            >
              <NotebookPenIcon className="size-3.5" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 opacity-0 group-hover/section:opacity-100 transition-opacity"
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {section.category !== "general" && (
        <TimeEditDialog
          open={isTimeDialogOpen}
          onOpenChange={setIsTimeDialogOpen}
          timeSeconds={displayTime ?? undefined}
          onSave={handleTimeSave}
        />
      )}
      {isEditorVisible && (
        <div className="pl-3 pr-3 pb-1 pt-0.5 prose-editor-compact">
          <RichTextEditor
            context={editorContext}
            sourceType="practice_entry"
            sourceId={section.id}
            initialContent={section.content as JSONContent | null}
            pieces={pieces}
            onSave={handleSave}
            onDismiss={() => setIsEditorVisible(false)}
            placeholder="Write your notes..."
          />
        </div>
      )}
    </div>
  );
}
