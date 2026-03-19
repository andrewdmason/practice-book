"use client";

import { useState, useTransition } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleTaskCompleted } from "@/app/(app)/focus-panel/actions";
import type { Task } from "@/lib/types";

export function TaskList({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);

  if (tasks.length === 0) return null;

  const openCount = tasks.filter((t) => !t.completed).length;

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
            onToggle={(completed) =>
              setTasks((prev) =>
                prev.map((t) => (t.id === task.id ? { ...t, completed } : t))
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
  onToggle,
}: {
  task: Task;
  onToggle: (completed: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer">
      <Checkbox
        className="mt-0.5"
        checked={task.completed}
        disabled={isPending}
        onCheckedChange={(checked) => {
          const completed = !!checked;
          onToggle(completed);
          startTransition(() => {
            toggleTaskCompleted(task.id, completed);
          });
        }}
      />
      <span
        className={`flex-1 ${task.completed ? "line-through text-muted-foreground" : ""} ${isPending ? "opacity-50" : ""}`}
      >
        {task.text}
      </span>
    </label>
  );
}
