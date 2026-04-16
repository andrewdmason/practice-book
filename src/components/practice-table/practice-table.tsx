"use client";

import { useState, useCallback, useEffect } from "react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { TaskRow } from "@/components/practice-table/task-row";
import { reorderTasks, createTask } from "@/app/(app)/timer/task-actions";
import { getFeedPage } from "@/app/(app)/feed/actions";
import type { FeedDay, TaskWithDetails, PieceKind } from "@/lib/types";

type PieceGroup = {
  pieceId: string | null;
  pieceName: string;
  pieceKind: PieceKind | null;
  tasks: TaskWithDetails[];
};

function groupTasksByPiece(tasks: TaskWithDetails[]): PieceGroup[] {
  const groups = new Map<string, PieceGroup>();

  for (const task of tasks) {
    const key = task.piece_id ?? "__general__";
    if (!groups.has(key)) {
      groups.set(key, {
        pieceId: task.piece_id,
        pieceName: task.piece_name ?? "General",
        pieceKind: task.piece_kind,
        tasks: [],
      });
    }
    groups.get(key)!.tasks.push(task);
  }

  return Array.from(groups.values());
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";
  if (dateStr === tomorrowStr) return "Tomorrow";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function DayGroup({
  day,
  focusedPieceId,
}: {
  day: FeedDay;
  focusedPieceId: string | null;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const filteredTasks = focusedPieceId
    ? day.tasks.filter((t) => t.piece_id === focusedPieceId)
    : day.tasks;

  const pieceGroups = groupTasksByPiece(filteredTasks);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      // Find which piece group this belongs to
      for (const group of pieceGroups) {
        const taskIds = group.tasks.map((t) => t.id);
        const oldIndex = taskIds.indexOf(active.id as string);
        const newIndex = taskIds.indexOf(over.id as string);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = [...taskIds];
          reordered.splice(oldIndex, 1);
          reordered.splice(newIndex, 0, active.id as string);
          void reorderTasks(reordered);
          break;
        }
      }
    },
    [pieceGroups]
  );

  const handleAddTask = async (pieceId: string | null) => {
    await createTask(pieceId, null, null, day.date);
  };

  if (pieceGroups.length === 0) return null;

  const totalSeconds = day.timeSummary.reduce(
    (sum, e) => sum + e.total_seconds,
    0
  );
  const totalMinutes = Math.round(totalSeconds / 60);

  return (
    <div className="mb-8">
      {/* Day header */}
      <div className="flex items-baseline gap-2 mb-3 px-1">
        <h2 className="text-lg font-semibold text-foreground">
          {formatDate(day.date)}
        </h2>
        {totalMinutes > 0 && (
          <span className="text-sm text-muted-foreground">
            {totalMinutes}m
          </span>
        )}
      </div>

      {/* Piece groups */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        {pieceGroups.map((group) => (
          <div key={group.pieceId ?? "__general__"} className="mb-3">
            {/* Piece header */}
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <h3 className="text-sm font-medium text-muted-foreground">
                {group.pieceName}
              </h3>
            </div>

            {/* Task rows */}
            <SortableContext
              items={group.tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {group.tasks.map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isFirst={index === 0}
                  onAddBelow={() => handleAddTask(group.pieceId)}
                />
              ))}
            </SortableContext>
          </div>
        ))}
      </DndContext>

      {/* Add general note (only when not filtered) */}
      {!focusedPieceId && (
        <button
          onClick={() => handleAddTask(null)}
          className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <PlusIcon className="size-3" />
          Add general note
        </button>
      )}
    </div>
  );
}

export function PracticeTable({
  initialData,
  typeFilter,
}: {
  initialData: { items: FeedDay[]; nextCursor: string | null };
  typeFilter?: "practice" | "lesson";
}) {
  const { focusedPieceId } = useTaskTimer();
  const [days, setDays] = useState<FeedDay[]>(initialData.items);
  const [cursor, setCursor] = useState<string | null>(initialData.nextCursor);
  const [loading, setLoading] = useState(false);

  // Update when initialData changes (e.g., from server revalidation)
  useEffect(() => {
    setDays(initialData.items);
    setCursor(initialData.nextCursor);
  }, [initialData]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const result = await getFeedPage(cursor, 7, typeFilter);
      setDays((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, typeFilter]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!cursor) return;
    const sentinel = document.getElementById("load-more-sentinel");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  return (
    <div className="pl-8">
      {days.map((day) => (
        <DayGroup
          key={day.date}
          day={day}
          focusedPieceId={focusedPieceId}
        />
      ))}

      {cursor && (
        <div id="load-more-sentinel" className="py-4 text-center">
          {loading && (
            <span className="text-sm text-muted-foreground">Loading...</span>
          )}
        </div>
      )}

      {days.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          No practice tasks yet. Start by adding a task!
        </div>
      )}
    </div>
  );
}
