"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClockIcon,
  PlusIcon,
  SquareIcon,
  TrashIcon,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useMetronome } from "@/components/metronome/metronome-context";
import { useTimer } from "@/components/timer/timer-context";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import {
  getTasksForPieceAndDate,
  createTask,
  completeTask,
  uncompleteTask,
  updateTaskField,
  deleteTask,
} from "@/app/(app)/timer/task-actions";
import { getSections } from "@/app/(app)/repertoire/section-actions";
import { flattenSections } from "@/lib/section-utils";
import type { PracticeTask } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Cache tasks client-side so re-renders are instant
const tasksCache = new Map<string, PracticeTask[]>();

// Cache section labels so we don't re-fetch
const sectionLabelsCache = new Map<string, Map<string, string>>();

/**
 * Inline task list for a piece within a feed card.
 * Fetches its own data for the given piece + date.
 */
export function InlineTaskList({
  pieceId,
  pieceName,
  composer,
  date,
  sectionLabels: externalLabels,
  isToday,
  onTotalRemainingChange,
}: {
  pieceId: string;
  pieceName: string;
  composer: string | null;
  date: string;
  sectionLabels?: Map<string, string>;
  isToday: boolean;
  onTotalRemainingChange?: (seconds: number) => void;
}) {
  const cacheKey = `${pieceId}:${date}`;
  const [tasks, setTasks] = useState<PracticeTask[]>(
    () => tasksCache.get(cacheKey) ?? []
  );
  const [loaded, setLoaded] = useState(!!tasksCache.has(cacheKey));
  const [sectionLabels, setSectionLabels] = useState<Map<string, string>>(
    () => externalLabels ?? sectionLabelsCache.get(pieceId) ?? new Map()
  );
  const [autoFocusTaskId, setAutoFocusTaskId] = useState<string | null>(null);
  const { activeTaskId, remainingSeconds } = useTaskTimer();

  const refresh = useCallback(() => {
    getTasksForPieceAndDate(pieceId, date).then((data) => {
      tasksCache.set(cacheKey, data);
      setTasks(data);
      setLoaded(true);
    });
  }, [pieceId, date, cacheKey]);

  // Fetch section labels if not provided externally
  useEffect(() => {
    if (externalLabels || sectionLabelsCache.has(pieceId)) return;
    getSections(pieceId).then((sections) => {
      const map = new Map<string, string>();
      for (const s of flattenSections(sections)) {
        map.set(s.id, s.label);
      }
      sectionLabelsCache.set(pieceId, map);
      setSectionLabels(map);
    });
  }, [pieceId, externalLabels]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("tasks-changed", handler);
    return () => window.removeEventListener("tasks-changed", handler);
  }, [refresh]);

  // Optimistically add tasks from external sources (header +, sidebar +)
  useEffect(() => {
    const updateAndCache = (updater: (prev: PracticeTask[]) => PracticeTask[]) => {
      setTasks((prev) => {
        const next = updater(prev);
        tasksCache.set(cacheKey, next);
        return next;
      });
    };
    const handleAdded = (e: Event) => {
      const task = (e as CustomEvent).detail as PracticeTask;
      if (task.piece_id !== pieceId || task.date !== date) return;
      setAutoFocusTaskId(task.id);
      updateAndCache((prev) => [...prev, task]);
    };
    const handleResolved = (e: Event) => {
      const { optimisticId, realId } = (e as CustomEvent).detail;
      setAutoFocusTaskId((prev) => (prev === optimisticId ? realId : prev));
      updateAndCache((prev) =>
        prev.map((t) => (t.id === optimisticId ? { ...t, id: realId } : t))
      );
    };
    const handlePaused = (e: Event) => {
      const { taskId, remainingSeconds: remaining } = (e as CustomEvent).detail;
      updateAndCache((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, timer_remaining_seconds: remaining } : t
        )
      );
    };
    window.addEventListener("task-added", handleAdded);
    window.addEventListener("task-id-resolved", handleResolved);
    window.addEventListener("task-timer-paused", handlePaused);
    return () => {
      window.removeEventListener("task-added", handleAdded);
      window.removeEventListener("task-id-resolved", handleResolved);
      window.removeEventListener("task-timer-paused", handlePaused);
    };
  }, [pieceId, date, cacheKey]);

  const openTasks = tasks.filter((t) => !t.completed);

  // Total remaining: use live countdown for active task, DB value for others
  const totalRemaining = openTasks.reduce((sum, t) => {
    if (t.id === activeTaskId) return sum + remainingSeconds;
    return sum + t.timer_remaining_seconds;
  }, 0);

  // Report total remaining to parent for header display
  useEffect(() => {
    onTotalRemainingChange?.(totalRemaining);
  }, [totalRemaining, onTotalRemainingChange]);

  if (!loaded && tasks.length === 0) return null;
  if (tasks.length === 0 && !isToday) return null;

  return (
    <div className="px-3 pb-2">
      {tasks.map((task) => (
        <InlineTaskRow
          key={task.id}
          task={task}
          pieceId={pieceId}
          pieceName={pieceName}
          composer={composer}
          sectionLabel={
            task.section_id
              ? sectionLabels.get(task.section_id) ?? null
              : null
          }
          onChanged={refresh}
          autoFocusText={task.id === autoFocusTaskId}
        />
      ))}
    </div>
  );
}

/**
 * Dispatch optimistic task-added event + fire server action.
 * Used by AddTaskButton and sidebar onAddTask.
 */
export function addTaskOptimistic(
  pieceId: string,
  date: string,
  sectionId: string | null = null,
  metronomeSpeed: number | null = null
) {
  const optimisticId = "__optimistic__" + Date.now();
  const optimisticTask: PracticeTask = {
    id: optimisticId,
    piece_id: pieceId,
    section_id: sectionId,
    date,
    text: "",
    metronome_speed: metronomeSpeed,
    timer_seconds: 900,
    timer_remaining_seconds: 900,
    completed: false,
    completed_at: null,
    sort_order: 999,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  window.dispatchEvent(
    new CustomEvent("task-added", { detail: optimisticTask })
  );
  createTask(pieceId, sectionId, metronomeSpeed, date).then(({ id }) => {
    window.dispatchEvent(
      new CustomEvent("task-id-resolved", {
        detail: { optimisticId, realId: id },
      })
    );
  });
}

/**
 * Add-task button for the feed section header (next to overflow menu).
 */
export function AddTaskButton({
  pieceId,
  date,
}: {
  pieceId: string;
  date: string;
}) {
  const handleClick = () => {
    addTaskOptimistic(pieceId, date);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="shrink-0 opacity-0 group-hover/section:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      title="Add task"
    >
      <PlusIcon className="size-3.5" />
    </button>
  );
}

/**
 * Single-line inline task row.
 * Layout: [checkbox] [section badge] [text] [♩=bpm] [▶] [MM:SS] [🗑]
 */
function InlineTaskRow({
  task,
  pieceId,
  pieceName,
  composer,
  sectionLabel,
  onChanged,
  autoFocusText,
}: {
  task: PracticeTask;
  pieceId: string;
  pieceName: string;
  composer: string | null;
  sectionLabel: string | null;
  onChanged: () => void;
  autoFocusText?: boolean;
}) {
  const { start: startMetronome } = useMetronome();
  const { isRunning, startTimer, switchTarget } = useTimer();
  const {
    activeTaskId,
    remainingSeconds,
    isExpired,
    startTaskTimer,
    pauseTaskTimer,
  } = useTaskTimer();

  const [editingText, setEditingText] = useState(!!autoFocusText);
  const [textValue, setTextValue] = useState(task.text);
  const [editingTempo, setEditingTempo] = useState(false);
  const [tempoValue, setTempoValue] = useState(
    String(task.metronome_speed ?? "")
  );
  const [localCompleted, setLocalCompleted] = useState(task.completed);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusText && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [autoFocusText]);

  const isActive = activeTaskId === task.id;
  const displaySeconds = isActive
    ? remainingSeconds
    : task.timer_remaining_seconds;
  const taskIsExpired = isActive && isExpired;

  const handleCheckChange = (checked: boolean) => {
    setLocalCompleted(checked);
    if (checked) {
      if (isActive) pauseTaskTimer();
      completeTask(task.id);
    } else {
      uncompleteTask(task.id);
    }
    onChanged();
  };

  const handleTextSave = () => {
    setEditingText(false);
    const trimmed = textValue.trim();
    if (trimmed !== task.text) {
      updateTaskField(task.id, "text", trimmed);
      onChanged();
    }
  };

  const handleTempoSave = () => {
    setEditingTempo(false);
    const parsed = tempoValue.trim() ? parseInt(tempoValue, 10) : null;
    const value = parsed && !isNaN(parsed) ? parsed : null;
    if (value !== task.metronome_speed) {
      updateTaskField(task.id, "metronome_speed", value);
      onChanged();
    }
  };

  const handleTimeAdjust = (e: React.MouseEvent) => {
    if (isActive) return;
    const delta = e.altKey ? 60 : 300;
    const newSeconds = Math.max(60, task.timer_seconds + delta);
    updateTaskField(task.id, "timer_seconds", newSeconds);
    onChanged();
  };

  const handleTimeAdjustDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isActive) return;
    const delta = e.altKey ? 60 : 300;
    const newSeconds = Math.max(60, task.timer_seconds - delta);
    updateTaskField(task.id, "timer_seconds", newSeconds);
    onChanged();
  };

  const handlePlayPause = () => {
    if (task.completed) return;
    if (isActive) {
      pauseTaskTimer();
    } else {
      startTaskTimer(
        task.id,
        displaySeconds > 0 ? displaySeconds : task.timer_seconds
      );
      const target = {
        category: "piece" as const,
        pieceId,
        pieceName,
        composer,
        ...(task.section_id && sectionLabel
          ? { sectionId: task.section_id, sectionLabel }
          : {}),
      };
      if (isRunning) {
        switchTarget(target);
      } else {
        startTimer(target);
      }
    }
  };

const handleDelete = () => {
    if (isActive) pauseTaskTimer();
    deleteTask(task.id);
    onChanged();
  };

  const handleMetronomeClick = () => {
    if (task.metronome_speed) {
      startMetronome(task.metronome_speed);
    }
  };

  return (
    <div
      className={cn(
        "group/task flex items-center gap-1.5 py-0.5 rounded-sm transition-colors",
        isActive && !taskIsExpired && "bg-primary/5",
        taskIsExpired && "bg-orange-500/10 animate-pulse"
      )}
    >
      {/* Checkbox */}
      <div className="shrink-0">
        <Checkbox
          checked={localCompleted}
          onCheckedChange={handleCheckChange}
          className="size-3.5"
        />
      </div>

      {/* Section badge — fixed width so columns align */}
      <div className="shrink-0 w-7">
        {sectionLabel && (
          <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1 py-0.5 leading-none">
            {sectionLabel}
          </span>
        )}
      </div>

      {/* Metronome pill — fixed width so columns align */}
      <div className="shrink-0 w-12">
        {editingTempo ? (
          <Input
            type="number"
            value={tempoValue}
            onChange={(e) => setTempoValue(e.target.value)}
            onBlur={handleTempoSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTempoSave();
              if (e.key === "Escape") {
                setEditingTempo(false);
                setTempoValue(String(task.metronome_speed ?? ""));
              }
            }}
            className="h-5 w-full text-[10px] px-1"
            autoFocus
            min={20}
            max={300}
            placeholder="BPM"
          />
        ) : task.metronome_speed ? (
          <button
            type="button"
            onClick={handleMetronomeClick}
            onContextMenu={(e) => {
              e.preventDefault();
              setTempoValue(String(task.metronome_speed ?? ""));
              setEditingTempo(true);
            }}
            className="inline-flex items-center rounded-md bg-secondary px-1 py-0.5 font-mono text-[10px] text-secondary-foreground cursor-pointer hover:bg-secondary/80 transition-colors"
            title="Click to play, right-click to edit"
          >
            ♩={task.metronome_speed}
          </button>
        ) : null}
      </div>

{/* Clock start/stop */}
      <button
        type="button"
        onClick={handlePlayPause}
        disabled={localCompleted}
        className={cn(
          "shrink-0 inline-flex items-center justify-center rounded-md size-5 transition-colors",
          isActive
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : taskIsExpired
              ? "bg-orange-500 text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          localCompleted && "cursor-not-allowed opacity-50"
        )}
      >
        {isActive ? (
          <SquareIcon className="size-2.5" />
        ) : (
          <ClockIcon className="size-2.5" />
        )}
      </button>

      {/* Time display — click +5m, right-click -5m, alt+click ±1m */}
      <button
        type="button"
        onClick={handleTimeAdjust}
        onContextMenu={handleTimeAdjustDown}
        disabled={isActive}
        className={cn(
          "shrink-0 font-mono text-[11px] tabular-nums transition-colors px-0.5 rounded w-10 text-right",
          isActive
            ? "text-destructive font-medium cursor-default"
            : taskIsExpired
              ? "text-orange-500 font-medium"
              : "text-muted-foreground/60 hover:text-foreground cursor-pointer"
        )}
        title="Click +5m, right-click -5m (hold Alt for ±1m)"
      >
        {formatTime(displaySeconds)}
      </button>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {editingText ? (
          <Input
            ref={textInputRef}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={handleTextSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTextSave();
              if (e.key === "Escape") {
                setEditingText(false);
                setTextValue(task.text);
              }
            }}
            className="h-5 text-xs px-1 py-0"
            autoFocus
            placeholder="Describe the task..."
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTextValue(task.text);
              setEditingText(true);
            }}
            className={cn(
              "text-xs text-left w-full truncate transition-colors",
              task.text
                ? "text-foreground hover:text-foreground/80"
                : "text-muted-foreground/50 italic hover:text-foreground",
              localCompleted && "line-through text-muted-foreground"
            )}
          >
            {task.text || "describe..."}
          </button>
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={handleDelete}
        className="shrink-0 opacity-0 group-hover/task:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
        title="Delete task"
      >
        <TrashIcon className="size-3" />
      </button>
    </div>
  );
}
