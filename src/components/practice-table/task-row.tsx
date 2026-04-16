"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVerticalIcon,
  PlusIcon,
  PlayIcon,
  PauseIcon,
  CircleIcon,
  CopyPlusIcon,
  MicIcon,
  Trash2Icon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { useMetronome } from "@/components/metronome/metronome-context";
import {
  updateTaskField,
  deleteTask,
  duplicateTaskToTomorrow,
  completeTask,
  uncompleteTask,
} from "@/app/(app)/timer/task-actions";
import { formatElapsed } from "@/lib/timer-utils";
import type { TaskWithDetails, SectionStatus } from "@/lib/types";
import { SECTION_STATUS_DOT_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskRow({
  task,
  isFirst,
  isLast,
  onAddBelow,
}: {
  task: TaskWithDetails;
  isFirst: boolean;
  isLast: boolean;
  onAddBelow: () => void;
}) {
  const {
    activeTaskId,
    remainingSeconds,
    startTaskTimer,
    pauseTaskTimer,
  } = useTaskTimer();

  const isActive = activeTaskId === task.id;
  const elapsed = task.timer_seconds - (isActive ? remainingSeconds : task.timer_remaining_seconds);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const metronomeCtx = useMetronome();

  const [text, setText] = useState(task.text);
  const [metronome, setMetronome] = useState(
    task.metronome_speed?.toString() ?? ""
  );
  const [editingMetronome, setEditingMetronome] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const metronomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.taskId === task.id) {
        // Force re-render with updated remaining
      }
    };
    window.addEventListener("task-timer-paused", handler);
    return () => window.removeEventListener("task-timer-paused", handler);
  }, [task.id]);

  const handleTimerClick = () => {
    if (isActive) {
      pauseTaskTimer();
    } else {
      startTaskTimer(task.id, task.timer_remaining_seconds);
    }
  };

  const handleTextBlur = () => {
    if (text !== task.text) {
      void updateTaskField(task.id, "text", text);
    }
  };

  const handleMetronomeBlur = () => {
    const val = metronome.trim();
    const num = val ? parseInt(val, 10) : null;
    if (num !== task.metronome_speed) {
      void updateTaskField(task.id, "metronome_speed", num);
    }
    setEditingMetronome(false);
  };

  const handleMetronomePillClick = () => {
    if (!task.metronome_speed) return;
    if (metronomeCtx.isActive && metronomeCtx.bpm === task.metronome_speed) {
      metronomeCtx.stop();
    } else {
      metronomeCtx.start(task.metronome_speed);
    }
  };

  const handleMetronomeRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setEditingMetronome(true);
    requestAnimationFrame(() => metronomeRef.current?.focus());
  };

  const handleComplete = () => {
    if (task.completed) {
      void uncompleteTask(task.id);
    } else {
      if (isActive) pauseTaskTimer();
      void completeTask(task.id);
    }
  };

  const timerGoalMinutes = Math.round(task.timer_seconds / 60);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/task flex items-stretch",
        isDragging && "opacity-50",
      )}
    >
      {/* Gutter — sits in the page's pl-8 padding area, like Notion */}
      <div className={cn(
        "-ml-8 w-8 shrink-0 flex items-center justify-center gap-0 transition-opacity",
        menuOpen ? "opacity-100" : "opacity-0 group-hover/task:opacity-100",
      )}>
        <button
          onClick={onAddBelow}
          className="flex items-center justify-center w-4 h-6 rounded-sm text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
        >
          <PlusIcon className="size-3.5" />
        </button>
        <DropdownMenu onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            {...attributes}
            {...listeners}
            className="flex items-center justify-center w-4 h-6 cursor-grab rounded-sm text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
          >
            <GripVerticalIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom">
            <DropdownMenuItem onClick={() => duplicateTaskToTomorrow(task.id)}>
              <CopyPlusIcon className="size-4 mr-2" />
              Duplicate to tomorrow
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MicIcon className="size-4 mr-2" />
              Record
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (isActive) pauseTaskTimer();
                void deleteTask(task.id);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2Icon className="size-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row content — card styling applied per-row */}
      <div
        className={cn(
          "flex-1 min-w-0 grid grid-cols-[auto_auto_auto_auto_auto_1fr] items-center gap-0 px-2 py-1.5 text-xs",
          "border-x bg-card",
          isFirst && "border-t rounded-t-lg",
          isLast && "border-b rounded-b-lg",
          !isLast && "border-b",
          isActive && "bg-primary/5",
          task.completed && "opacity-50"
        )}
      >
        {/* Complete checkbox */}
        <div className="w-6 flex items-center justify-center">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={handleComplete}
            className="size-3.5 rounded"
          />
        </div>

        {/* Section + status dot */}
        <div className="flex items-center gap-1.5 min-w-0 px-1">
          {task.section_status !== null && (
            <CircleIcon
              className={cn(
                "size-2.5 shrink-0 fill-current",
                SECTION_STATUS_DOT_COLORS[task.section_status as SectionStatus]
              )}
            />
          )}
          <span className="truncate text-muted-foreground">
            {task.section_label ?? "—"}
          </span>
        </div>

        {/* Metronome pill — click to start/stop, right-click to edit */}
        <div className="w-14 px-1">
          {editingMetronome ? (
            <input
              ref={metronomeRef}
              type="text"
              inputMode="numeric"
              value={metronome}
              onChange={(e) => setMetronome(e.target.value)}
              onBlur={handleMetronomeBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleMetronomeBlur();
                }
              }}
              className="w-full bg-transparent text-center text-muted-foreground focus:text-foreground focus:outline-none tabular-nums"
            />
          ) : (
            <button
              onClick={handleMetronomePillClick}
              onContextMenu={handleMetronomeRightClick}
              onDoubleClick={() => {
                setEditingMetronome(true);
                requestAnimationFrame(() => metronomeRef.current?.focus());
              }}
              className={cn(
                "w-full rounded-full px-2 py-0.5 tabular-nums text-center transition-colors",
                task.metronome_speed
                  ? metronomeCtx.isActive && metronomeCtx.bpm === task.metronome_speed
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                  : "text-muted-foreground/40"
              )}
            >
              {task.metronome_speed ?? "bpm"}
            </button>
          )}
        </div>

        {/* Time goal */}
        <div className="w-10 px-1 text-muted-foreground tabular-nums">
          {timerGoalMinutes > 0 ? `${timerGoalMinutes}m` : "—"}
        </div>

        {/* Timer button */}
        <button
          onClick={handleTimerClick}
          disabled={task.completed}
          className={cn(
            "flex items-center gap-1 w-16 rounded px-1.5 py-0.5 tabular-nums transition-colors",
            isActive
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted text-muted-foreground hover:text-foreground",
            task.completed && "cursor-not-allowed"
          )}
        >
          {isActive ? (
            <PauseIcon className="size-3" />
          ) : (
            <PlayIcon className="size-3" />
          )}
          {formatElapsed(Math.max(0, elapsed))}
        </button>

        {/* Text notes — widest column */}
        <div className="min-w-0 px-1">
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleTextBlur}
            rows={1}
            placeholder="Notes..."
            className="w-full bg-transparent text-muted-foreground focus:text-foreground focus:outline-none resize-none leading-tight"
          />
        </div>
      </div>
    </div>
  );
}
