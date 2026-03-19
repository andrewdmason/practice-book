"use client";

import { useState, useTransition } from "react";
import { TargetIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleGoalCompleted } from "@/app/(app)/focus-panel/actions";
import type { Goal } from "@/lib/types";

export function GoalList({ initialGoals }: { initialGoals: Goal[] }) {
  const [goals, setGoals] = useState(initialGoals);

  if (goals.length === 0) return null;

  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        <TargetIcon className="size-3.5" />
        Goals
        <span className="ml-auto text-[10px] font-normal bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
          {goals.length}
        </span>
      </h3>
      <div className="space-y-2">
        {goals.map((goal) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            onToggle={() => setGoals((prev) => prev.filter((g) => g.id !== goal.id))}
          />
        ))}
      </div>
    </div>
  );
}

function GoalRow({ goal, onToggle }: { goal: Goal; onToggle: () => void }) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer">
      <Checkbox
        className="mt-0.5"
        checked={false}
        disabled={isPending}
        onCheckedChange={() => {
          onToggle();
          startTransition(() => {
            toggleGoalCompleted(goal.id, true);
          });
        }}
      />
      <span className={`flex-1 ${isPending ? "opacity-50" : ""}`}>
        {goal.text}
      </span>
    </label>
  );
}
