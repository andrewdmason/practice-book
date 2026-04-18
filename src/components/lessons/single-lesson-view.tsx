"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useLessonView } from "./lesson-view-context";
import { LessonHeader } from "./lesson-header";
import { LessonSection } from "./lesson-section";
import { AddPieceSection } from "./add-piece-section";
import { reorderLessonSections } from "@/app/(app)/lessons/actions";
import type { LessonEntryWithPiece } from "@/lib/types";

export function SingleLessonView() {
  const { lesson, activeSectionId, setActiveSectionId } = useLessonView();
  const router = useRouter();

  const [entries, setEntries] = useState<LessonEntryWithPiece[]>(lesson.entries);

  useEffect(() => {
    setEntries(lesson.entries);
  }, [lesson.entries]);

  const generalEntry = entries.find((e) => e.piece_id === null) ?? null;
  const pieceEntries = entries.filter((e) => e.piece_id !== null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = pieceEntries.findIndex((e) => e.id === active.id);
    const newIdx = pieceEntries.findIndex((e) => e.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = arrayMove(pieceEntries, oldIdx, newIdx);
    const next = generalEntry ? [generalEntry, ...reordered] : reordered;
    setEntries(next);

    await reorderLessonSections(
      lesson.id,
      reordered.map((e) => e.id)
    );
    router.refresh();
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveSectionId(null);
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-lesson-section]")) return;
      if (target.closest("[data-lesson-header]")) return;
      setActiveSectionId(null);
    };
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setActiveSectionId]);

  return (
    <div>
      <div data-lesson-header>
        <LessonHeader />
      </div>

      <div className="flex flex-col gap-3">
        {generalEntry && (
          <LessonSection entry={generalEntry} isGeneral sortable={false} />
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pieceEntries.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            {pieceEntries.map((entry) => (
              <LessonSection key={entry.id} entry={entry} />
            ))}
          </SortableContext>
        </DndContext>

        <div className="mt-2">
          <AddPieceSection lessonId={lesson.id} entries={entries} />
        </div>

        {entries.length === 0 && (
          <div className="rounded-lg border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            No pieces logged yet. Click &ldquo;Add piece&rdquo; to start.
          </div>
        )}
      </div>
    </div>
  );
}
