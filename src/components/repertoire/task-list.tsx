"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, PencilIcon } from "lucide-react";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { updateTaskProgress, updateTaskNote } from "@/app/(app)/focus-panel/actions";
import { getNextBounceProgress } from "@/lib/progress-bounce";
import type { Task } from "@/lib/types";

export function TaskList({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);

  if (tasks.length === 0) return null;

  const openCount = tasks.filter((t) => t.progress < 4).length;

  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        <CheckCircle2Icon className="size-3.5" />
        Tasks
        {openCount > 0 && (
          <span className="ml-auto text-[10px] font-normal bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
            {openCount}
          </span>
        )}
      </h3>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onProgressChange={(progress) =>
              setTasks((prev) =>
                prev.map((t) => (t.id === task.id ? { ...t, progress } : t))
              )
            }
            onNoteChange={(note) =>
              setTasks((prev) =>
                prev.map((t) => (t.id === task.id ? { ...t, note } : t))
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onProgressChange,
  onNoteChange,
}: {
  task: Task;
  onProgressChange: (progress: number) => void;
  onNoteChange: (note: string | null) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(task.note ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    let newProgress: number;
    if (e.altKey) {
      newProgress = (task.progress + 1) % 5;
    } else {
      newProgress = task.progress === 4 ? 0 : 4;
    }
    onProgressChange(newProgress);
    updateTaskProgress(task.id, newProgress);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const newProgress = getNextBounceProgress(task.id, task.progress);
    onProgressChange(newProgress);
    updateTaskProgress(task.id, newProgress);
  };

  const handleNoteSave = () => {
    setEditingNote(false);
    const trimmed = noteValue.trim() || null;
    if (trimmed !== task.note) {
      onNoteChange(trimmed);
      window.dispatchEvent(
        new CustomEvent("task-note-updated", {
          detail: { taskId: task.id, note: trimmed },
        })
      );
      updateTaskNote(task.id, trimmed);
    }
  };

  useEffect(() => {
    if (editingNote && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingNote]);

  return (
    <div className="group">
      <div className="flex items-start gap-2 text-sm">
        <button
          type="button"
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          className="mt-0.5 shrink-0 text-primary"
        >
          <ProgressCircle progress={task.progress} size={16} />
        </button>
        <span
          className={`flex-1 ${task.progress === 4 ? "line-through text-muted-foreground" : ""}`}
        >
          {task.text}
        </span>
        {!editingNote && !task.note && (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0 mt-0.5"
          >
            <PencilIcon className="size-3" />
          </button>
        )}
      </div>
      {/* Existing note display */}
      {task.note && !editingNote && (
        <p
          className="ml-6 mt-0.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={() => {
            setNoteValue(task.note ?? "");
            setEditingNote(true);
          }}
        >
          {task.note}
        </p>
      )}
      {/* Note editing */}
      {editingNote && (
        <textarea
          ref={textareaRef}
          value={noteValue}
          onChange={(e) => setNoteValue(e.target.value)}
          onBlur={handleNoteSave}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleNoteSave();
            }
            if (e.key === "Escape") {
              setEditingNote(false);
              setNoteValue(task.note ?? "");
            }
          }}
          className="ml-6 mt-1 w-[calc(100%-1.5rem)] rounded border bg-background px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          rows={2}
          placeholder="Add a note..."
        />
      )}
    </div>
  );
}
