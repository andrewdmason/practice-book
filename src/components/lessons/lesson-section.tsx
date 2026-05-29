"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LessonRichText } from "./lesson-rich-text";
import { useLessonView } from "./lesson-view-context";
import {
  deleteLessonEntry,
  updateLessonEntry,
} from "@/app/practice/lessons/actions";
import type { LessonEntryWithPiece } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LessonSection({
  entry,
  isGeneral = false,
  sortable = true,
}: {
  entry: LessonEntryWithPiece;
  isGeneral?: boolean;
  sortable?: boolean;
}) {
  const { activeSectionId, setActiveSectionId } = useLessonView();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const sortableState = useSortable({
    id: entry.id,
    disabled: !sortable,
  });

  const style = sortable
    ? {
        transform: CSS.Transform.toString(sortableState.transform),
        transition: sortableState.transition,
      }
    : undefined;

  const isActive = activeSectionId === entry.id;

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-section-no-activate]")) return;
    setActiveSectionId(entry.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      if (isActive) setActiveSectionId(null);
      await deleteLessonEntry(entry.id);
      router.refresh();
    });
  };

  const handleSave = (html: string) =>
    updateLessonEntry(entry.id, { notes: html });

  const title = isGeneral ? "General notes" : entry.piece_name ?? "Piece";

  return (
    <div
      ref={sortable ? sortableState.setNodeRef : undefined}
      style={style}
      data-lesson-section
      onClick={handleContainerClick}
      className={cn(
        "group rounded-lg border bg-card p-4 transition-colors cursor-pointer",
        isActive && "border-primary/60 bg-primary/[0.03]"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-foreground truncate">
            {title}
          </div>
          {!isGeneral && entry.piece_composer && (
            <div className="text-xs text-muted-foreground truncate">
              {entry.piece_composer}
            </div>
          )}
        </div>
        {!isGeneral && (
          <button
            type="button"
            data-section-no-activate
            onClick={handleDelete}
            disabled={pending}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
            title="Remove section"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        )}
      </div>
      <div data-section-no-activate>
        <LessonRichText
          initialHtml={entry.notes}
          onSave={handleSave}
          onFocus={() => setActiveSectionId(entry.id)}
        />
      </div>
    </div>
  );
}
