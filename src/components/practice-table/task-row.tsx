"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVerticalIcon,
  PlusIcon,
  CircleIcon,
  CopyPlusIcon,
  MicIcon,
  Trash2Icon,
  MetronomeIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { useMetronome } from "@/components/metronome/metronome-context";
import { TimerCell } from "@/components/practice-table/timer-cell";
import {
  updateTaskField,
  deleteTask,
  duplicateTaskToTomorrow,
  completeTask,
  uncompleteTask,
} from "@/app/(app)/timer/task-actions";
import type { TaskWithDetails, SectionStatus } from "@/lib/types";
import { SECTION_STATUS_DOT_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskRow({
  task,
  isFirst,
  onAddBelow,
}: {
  task: TaskWithDetails;
  isFirst: boolean;
  onAddBelow: () => void;
}) {
  const {
    activeTaskId,
    remainingSeconds,
    isExpired,
    startTaskTimer,
    pauseTaskTimer,
  } = useTaskTimer();

  const isActive = activeTaskId === task.id;
  const goalReached = isActive && isExpired;
  const elapsed = task.timer_seconds - (isActive ? remainingSeconds : task.timer_remaining_seconds);

  const activeRowBg = goalReached ? "bg-green-500" : "bg-red-500";
  const activeBorderClasses = goalReached
    ? "border-r border-green-400 border-b-green-400 border-t-green-400"
    : "border-r border-red-400 border-b-red-400 border-t-red-400";
  const activeSectionBorderClasses = goalReached
    ? "border-r border-green-400 border-b-green-400 border-l-green-400 border-t-green-400"
    : "border-r border-red-400 border-b-red-400 border-l-red-400 border-t-red-400";
  const activeNotesBorderClasses = goalReached
    ? "border-r-green-400 border-b-green-400 border-t-green-400"
    : "border-r-red-400 border-b-red-400 border-t-red-400";

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
  const [optimisticCompleted, setOptimisticCompleted] = useState(task.completed);
  const [optimisticGoalSeconds, setOptimisticGoalSeconds] = useState(
    task.timer_seconds
  );
  const [noteOpen, setNoteOpen] = useState(false);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const metronomeRef = useRef<HTMLInputElement>(null);

  // Sync optimistic state when server revalidation brings a new value
  useEffect(() => {
    setOptimisticCompleted(task.completed);
  }, [task.completed]);
  useEffect(() => {
    setOptimisticGoalSeconds(task.timer_seconds);
  }, [task.timer_seconds]);

  // Adopt the server's text when it changes — but not while the user is editing.
  const [prevServerText, setPrevServerText] = useState(task.text);
  if (task.text !== prevServerText) {
    setPrevServerText(task.text);
    if (!noteOpen) setText(task.text);
  }

  const autoGrowNote = useCallback(() => {
    const el = noteTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const handleNoteOpenChange = (open: boolean) => {
    if (!open && text !== task.text) {
      void updateTaskField(task.id, "text", text);
    }
    setNoteOpen(open);
    if (open) {
      requestAnimationFrame(() => {
        const el = noteTextareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        autoGrowNote();
      });
    }
  };

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
    const nextValue = !optimisticCompleted;
    setOptimisticCompleted(nextValue);
    if (nextValue) {
      if (isActive) pauseTaskTimer();
      void completeTask(task.id);
    } else {
      void uncompleteTask(task.id);
    }
  };

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

      {/* Row content — Notion-style: bordered cells, no fill */}
      <div
        className={cn(
          "flex-1 min-w-0 grid grid-cols-[32px_56px_72px_128px_1fr] items-stretch text-xs transition-colors",
          isActive ? cn(activeRowBg, "text-white") : "text-foreground",
          optimisticCompleted && "opacity-50"
        )}
      >
        {/* Complete checkbox — no frame borders, only a right divider */}
        <div className="flex items-center justify-center px-2 py-1.5">
          <input
            type="checkbox"
            checked={optimisticCompleted}
            onChange={handleComplete}
            className="size-3.5 rounded"
          />
        </div>

        {/* Section + status dot */}
        <div
          className={cn(
            "flex items-center gap-1 min-w-0 px-2 py-1.5 border-b border-l",
            isFirst && "border-t",
            !isActive && "border-r border-border/60",
            isActive && activeSectionBorderClasses
          )}
        >
          {task.section_status !== null && (
            <CircleIcon
              className={cn(
                "size-2.5 shrink-0 fill-current",
                isActive
                  ? "text-white/80"
                  : SECTION_STATUS_DOT_COLORS[task.section_status as SectionStatus]
              )}
            />
          )}
          <span className={cn("truncate", isActive ? "text-white" : "text-muted-foreground")}>
            {task.section_label ?? "—"}
          </span>
        </div>

        {/* Metronome pill — click to start/stop, right-click to edit */}
        <div
          className={cn(
            "flex items-center px-2 py-1.5 border-b",
            isFirst && "border-t",
            !isActive && "border-r border-border/60",
            isActive && activeBorderClasses
          )}
        >
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
              className={cn(
                "w-full bg-transparent text-center focus:outline-none tabular-nums",
                isActive ? "text-white placeholder:text-white/60" : "text-muted-foreground focus:text-foreground"
              )}
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
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums transition-colors",
                task.metronome_speed
                  ? isActive
                    ? "bg-white/20 text-white hover:bg-white/30"
                    : metronomeCtx.isActive && metronomeCtx.bpm === task.metronome_speed
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                  : isActive ? "text-white/50" : "text-muted-foreground/40"
              )}
            >
              <MetronomeIcon className="size-3" />
              {task.metronome_speed ?? "—"}
            </button>
          )}
        </div>

        {/* Timer + goal */}
        <div
          className={cn(
            "flex items-center px-2 py-1.5 border-b",
            isFirst && "border-t",
            !isActive && "border-r border-border/60",
            isActive && activeBorderClasses
          )}
        >
          <TimerCell
            elapsedSeconds={elapsed}
            goalSeconds={optimisticGoalSeconds}
            isActive={isActive}
            isCompleted={optimisticCompleted}
            onToggleTimer={handleTimerClick}
            onChangeGoal={(seconds) => {
              setOptimisticGoalSeconds(seconds);
              void updateTaskField(task.id, "timer_seconds", seconds);
            }}
          />
        </div>

        {/* Text notes — widest column. Truncates to one line; click opens an overlay editor. */}
        <div
          className={cn(
            "flex items-center min-w-0 px-2 py-1.5 border-b border-r",
            isFirst && "border-t",
            isActive
              ? activeNotesBorderClasses
              : "border-r-border/60"
          )}
        >
          <Popover open={noteOpen} onOpenChange={handleNoteOpenChange}>
            <PopoverTrigger
              className={cn(
                "block w-full min-w-0 truncate text-left leading-tight focus:outline-none cursor-text",
                isActive
                  ? text
                    ? "text-white"
                    : "text-white/60"
                  : text
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50"
              )}
            >
              {text || "Notes..."}
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={-28}
              className="min-w-[320px] max-w-[520px] p-2 gap-0"
            >
              <textarea
                ref={noteTextareaRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  autoGrowNote();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    handleNoteOpenChange(false);
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleNoteOpenChange(false);
                  }
                }}
                placeholder="Notes..."
                rows={1}
                className="w-full bg-transparent focus:outline-none resize-none leading-tight text-xs text-foreground placeholder:text-muted-foreground/50"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
