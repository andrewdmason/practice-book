"use client";

import { useCallback, useState } from "react";
import { NotebookPenIcon, ClockIcon, MoreHorizontalIcon, Trash2Icon, MusicIcon, PencilIcon, EyeIcon } from "lucide-react";
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
import { deleteSection } from "@/app/(app)/feed/actions";
import { formatMinutes } from "@/lib/timer-utils";
import { SessionEntriesDialog } from "@/components/feed/session-entries-dialog";
import type { PracticeEntrySection, StatusChange } from "@/lib/types";
import { TECHNIQUE_PIECE_ID, SIGHT_READING_PIECE_ID } from "@/lib/types";
import { SECTION_STATUS_COLORS, SECTION_STATUS_PERCENTAGE } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { InlineTaskList, AddTaskButton } from "@/components/timer/task-panel";
import { cn } from "@/lib/utils";

const SYSTEM_PIECE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  [TECHNIQUE_PIECE_ID]: PencilIcon,
  [SIGHT_READING_PIECE_ID]: EyeIcon,
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
  date: string;
  isToday: boolean;
  allowTasks?: boolean;
  isActive?: boolean;
  timeSeconds?: number;
  sinceLastLessonSeconds?: number;
  sinceLastLessonSecondsPerDay?: number;
  editorContext?: "practice_entry" | "lesson";
  statusChanges?: StatusChange[];
  sectionLabels?: Map<string, string>;
  onTaskTimeChange?: (pieceId: string, seconds: number) => void;
};

export function FeedSection({ section, date, isToday, allowTasks, isActive, timeSeconds, sinceLastLessonSeconds, sinceLastLessonSecondsPerDay, editorContext = "practice_entry", statusChanges, sectionLabels, onTaskTimeChange }: FeedSectionProps) {
  const showTasks = allowTasks ?? isToday;
  const sectionHasContent = hasContent(section.content);
  const isLessonGeneral = section.category === "general" && editorContext === "lesson";
  const [isEditorVisible, setIsEditorVisible] = useState(sectionHasContent || isLessonGeneral);
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [taskTimeRemaining, setTaskTimeRemaining] = useState(0);

  const handleTaskTimeChange = useCallback((seconds: number) => {
    setTaskTimeRemaining(seconds);
    if (section.piece_id) onTaskTimeChange?.(section.piece_id, seconds);
  }, [section.piece_id, onTaskTimeChange]);

  const displayTime = timeSeconds;

  const label = section.category === "general"
    ? "General Notes"
    : section.piece_name ?? "Unknown Piece";

  const subtitle = section.category === "piece" ? section.composer : null;

  const isSystemPiece = section.piece_id === TECHNIQUE_PIECE_ID || section.piece_id === SIGHT_READING_PIECE_ID;
  const SectionIcon = section.piece_id
    ? (SYSTEM_PIECE_ICONS[section.piece_id] ?? MusicIcon)
    : null;

  const handleSave = useCallback(
    async (content: JSONContent) => {
      await saveEditorContent(section.id, content);
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

  if (isDeleted) return null;

  // Hide auto-created system piece sections (technique, sight_reading) when they
  // have no time, no content, and aren't actively being timed.
  // Lesson sections are always shown — they're manually added via the + button.
  if (
    editorContext !== "lesson" &&
    (isToday || showTasks) &&
    isSystemPiece &&
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
          {SectionIcon && <SectionIcon className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="font-medium truncate">{label}</span>
          {subtitle && (
            <span className="text-muted-foreground truncate text-xs">
              {subtitle}
            </span>
          )}
          {editorContext === "lesson" ? (
            sinceLastLessonSeconds != null && sinceLastLessonSeconds > 0 ? (
              <>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs tabular-nums font-medium whitespace-nowrap">
                  <ClockIcon className="size-3 shrink-0" />
                  {formatMinutes(sinceLastLessonSeconds)}
                </span>
                {sinceLastLessonSecondsPerDay != null && sinceLastLessonSecondsPerDay > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs tabular-nums font-medium whitespace-nowrap">
                    {formatMinutes(sinceLastLessonSecondsPerDay)}/day
                  </span>
                )}
              </>
            ) : !sectionHasContent ? (
              <span className="shrink-0 text-xs text-muted-foreground/50">empty</span>
            ) : null
          ) : displayTime != null && displayTime > 0 ? (
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
          ) : !sectionHasContent && taskTimeRemaining <= 0 ? (
            <span className="shrink-0 text-xs text-muted-foreground/50">empty</span>
          ) : null}
          {taskTimeRemaining > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs tabular-nums font-medium whitespace-nowrap">
              {formatMinutes(taskTimeRemaining)} left
            </span>
          )}
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
          {section.category === "piece" && section.piece_id && showTasks && editorContext === "practice_entry" && (
            <AddTaskButton pieceId={section.piece_id} date={date} />
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
      {statusChanges && statusChanges.length > 0 && (
        <div className="px-3 pb-1 flex flex-wrap gap-x-3 gap-y-1">
          {statusChanges.map((change) => {
            const pct = Math.round(SECTION_STATUS_PERCENTAGE[change.newStatus] * 100);
            const diff = change.newStatus - change.oldStatus;
            return (
              <span
                key={change.sectionLabel}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                <span
                  className={`inline-block size-2.5 rounded-sm ${SECTION_STATUS_COLORS[change.newStatus]}`}
                />
                <span className="font-medium text-foreground">
                  {change.sectionLabel}:
                </span>
                <span>
                  {pct}%{diff !== 0 && ` (${diff > 0 ? "+" : ""}${diff})`}
                </span>
              </span>
            );
          })}
        </div>
      )}
      {section.category === "piece" && section.piece_id && editorContext === "practice_entry" && (
        <InlineTaskList
          pieceId={section.piece_id}
          pieceName={section.piece_name ?? "Unknown Piece"}
          composer={section.composer ?? null}
          date={date}
          sectionLabels={sectionLabels}
          isToday={isToday}
          allowTasks={showTasks}
          onTotalRemainingChange={handleTaskTimeChange}
        />
      )}
      {section.piece_id && (
        <SessionEntriesDialog
          open={isTimeDialogOpen}
          onOpenChange={setIsTimeDialogOpen}
          date={date}
          pieceId={section.piece_id}
          label={label}
        />
      )}
      {isEditorVisible && (
        <div className="pl-3 pr-3 pb-1 pt-0.5 prose-editor-compact">
          <RichTextEditor
            context={editorContext}

            sourceId={section.id}
            initialContent={section.content as JSONContent | null}
            onSave={handleSave}
            onDismiss={() => setIsEditorVisible(false)}
            placeholder="Write your notes..."
            autoFocus={!sectionHasContent}
          />
        </div>
      )}
    </div>
  );
}
