"use client";

import { useRef, useState } from "react";
import { Trash2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteTask,
  updateTaskField,
} from "@/app/(app)/timer/task-actions";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import {
  emitOptimisticTaskDelete,
  emitOptimisticTaskUpdate,
} from "@/lib/optimistic-task";
import type { TaskWithDetails } from "@/lib/types";
import { cn } from "@/lib/utils";

type PieceSessionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tasks: TaskWithDetails[];
};

function elapsedSecondsOf(task: TaskWithDetails): number {
  return Math.max(0, task.timer_seconds - task.timer_remaining_seconds);
}

function taskLabel(task: TaskWithDetails): string {
  const parts: string[] = [];
  if (task.section_label) parts.push(task.section_label);
  if (task.text) parts.push(task.text);
  return parts.join(" — ") || "Untitled";
}

function MinutesInput({
  initialValue,
  onCommit,
  disabled,
}: {
  initialValue: number;
  onCommit: (seconds: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(Math.round(initialValue / 60)));
  const lastCommittedRef = useRef(Math.round(initialValue / 60));

  const commit = () => {
    const parsed = parseInt(text, 10);
    const nextMinutes = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    if (nextMinutes !== lastCommittedRef.current) {
      lastCommittedRef.current = nextMinutes;
      onCommit(nextMinutes * 60);
    }
    setText(String(nextMinutes));
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        disabled={disabled}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className="h-7 w-14 rounded border border-input bg-transparent px-1.5 text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span className="text-xs text-muted-foreground">min</span>
    </div>
  );
}

function SessionRow({
  task,
  isActive,
}: {
  task: TaskWithDetails;
  isActive: boolean;
}) {
  const handleCommit = (nextElapsedSeconds: number) => {
    const nextRemaining = task.timer_seconds - nextElapsedSeconds;
    emitOptimisticTaskUpdate(task.id, { timer_remaining_seconds: nextRemaining });
    void updateTaskField(task.id, "timer_remaining_seconds", nextRemaining);
  };

  const handleDelete = () => {
    emitOptimisticTaskDelete(task.id);
    void deleteTask(task.id);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        isActive && "bg-muted/50"
      )}
    >
      <span className="min-w-0 flex-1 truncate text-foreground">
        {taskLabel(task)}
      </span>
      <MinutesInput
        initialValue={elapsedSecondsOf(task)}
        onCommit={handleCommit}
        disabled={isActive}
      />
      <button
        type="button"
        onClick={handleDelete}
        className="shrink-0 rounded p-1 text-muted-foreground/50 hover:text-destructive"
        title="Delete task"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}

export function PieceSessionsDialog({
  open,
  onOpenChange,
  title,
  tasks,
}: PieceSessionsDialogProps) {
  const { activeTaskId } = useTaskTimer();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {tasks.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No sessions recorded
            </p>
          ) : (
            tasks.map((task) => (
              <SessionRow
                key={task.id}
                task={task}
                isActive={task.id === activeTaskId}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
