"use client";

import { useCallback, useState } from "react";
import { NotebookPenIcon, ClockIcon, MoreHorizontalIcon, Trash2Icon, MusicIcon, PencilIcon, EyeIcon, ArrowRightIcon } from "lucide-react";
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
import type { PracticeEntrySection, StatusChange, TimerCategory } from "@/lib/types";
import { SECTION_STATUS_COLORS } from "@/lib/types";
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

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  piece: MusicIcon,
  technique: PencilIcon,
  sight_reading: EyeIcon,
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
  isActive?: boolean;
  timeSeconds?: number;
  sinceLastLessonSeconds?: number;
  sinceLastLessonSecondsPerDay?: number;
  editorContext?: "practice_entry" | "lesson";
  statusChanges?: StatusChange[];
};

export function FeedSection({ section, date, isToday, isActive, timeSeconds, sinceLastLessonSeconds, sinceLastLessonSecondsPerDay, editorContext = "practice_entry", statusChanges }: FeedSectionProps) {
  const sectionHasContent = hasContent(section.content);
  const isLessonGeneral = section.category === "general" && editorContext === "lesson";
  const [isEditorVisible, setIsEditorVisible] = useState(sectionHasContent || isLessonGeneral);
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const displayTime = timeSeconds;

  const label =
    section.category === "piece"
      ? section.piece_name ?? "Unknown Piece"
      : CATEGORY_LABELS[section.category] ?? section.category;

  const subtitle =
    section.category === "piece" ? section.composer : null;

  const SectionIcon = CATEGORY_ICONS[section.category] ?? null;

  const handleSave = useCallback(
    async (content: JSONContent) => {
      await saveEditorContent("practice_entry", section.id, content);
      window.dispatchEvent(new CustomEvent("assignments-changed"));
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

  // Hide auto-created fixed-category sections (technique, sight_reading) when they
  // have no time, no content, and aren't actively being timed. Piece sections are
  // always shown since they're only created intentionally (by the user or timer).
  // Lesson sections are always shown — they're manually added via the + button.
  if (
    editorContext !== "lesson" &&
    isToday &&
    (section.category === "technique" || section.category === "sight_reading") &&
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
      {statusChanges && statusChanges.length > 0 && (
        <div className="px-3 pb-1 flex flex-wrap gap-x-3 gap-y-1">
          {statusChanges.map((change) => (
            <span
              key={change.sectionLabel}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            >
              <span className="font-medium text-foreground">
                {change.sectionLabel}
              </span>
              <span
                className={`inline-block size-2.5 rounded-sm ${SECTION_STATUS_COLORS[change.oldStatus]}`}
              />
              <ArrowRightIcon className="size-2.5" />
              <span
                className={`inline-block size-2.5 rounded-sm ${SECTION_STATUS_COLORS[change.newStatus]}`}
              />
            </span>
          ))}
        </div>
      )}
      {section.category !== "general" && (
        <SessionEntriesDialog
          open={isTimeDialogOpen}
          onOpenChange={setIsTimeDialogOpen}
          date={date}
          category={section.category as TimerCategory}
          pieceId={section.piece_id}
          label={label}
        />
      )}
      {isEditorVisible && (
        <div className="pl-3 pr-3 pb-1 pt-0.5 prose-editor-compact">
          <RichTextEditor
            context={editorContext}
            sourceType="practice_entry"
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
