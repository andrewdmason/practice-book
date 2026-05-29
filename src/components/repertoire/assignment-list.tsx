"use client";

import { useState, useRef } from "react";
import { CheckCircle2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { toggleAssignmentCompleted, createAssignment, deleteAssignment } from "@/app/practice/focus-panel/actions";
import type { Assignment } from "@/lib/types";

export function AssignmentList({ pieceId, initialAssignments }: { pieceId?: string; initialAssignments: Assignment[] }) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [newText, setNewText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const openCount = assignments.filter((t) => !t.completed).length;

  const handleCreate = async () => {
    const text = newText.trim();
    if (!text || !pieceId) return;
    setNewText("");
    // Optimistic: add to list
    const tempId = crypto.randomUUID();
    const tempAssignment: Assignment = {
      id: tempId,
      piece_id: pieceId,
      text,
      completed: false,
      completed_at: null,
      sort_order: 0,
      metronome_speed: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setAssignments((prev) => [tempAssignment, ...prev]);
    const created = await createAssignment(pieceId, text);
    setAssignments((prev) => prev.map((a) => (a.id === tempId ? created : a)));
    inputRef.current?.focus();
  };

  const handleToggle = async (assignment: Assignment) => {
    const newCompleted = !assignment.completed;
    setAssignments((prev) =>
      prev.map((t) =>
        t.id === assignment.id
          ? { ...t, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
          : t
      )
    );
    await toggleAssignmentCompleted(assignment.id, newCompleted);
  };

  const handleDelete = async (assignmentId: string) => {
    setAssignments((prev) => prev.filter((t) => t.id !== assignmentId));
    await deleteAssignment(assignmentId);
  };

  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        <CheckCircle2Icon className="size-3.5" />
        Assignments
        {openCount > 0 && (
          <span className="ml-auto text-[10px] font-normal bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
            {openCount}
          </span>
        )}
      </h3>

      {/* New assignment input */}
      {pieceId && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
          className="flex items-center gap-2 mb-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Add assignment..."
            className="flex-1 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={!newText.trim()}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
          >
            <PlusIcon className="size-4" />
          </button>
        </form>
      )}

      <div className="space-y-2">
        {assignments.map((assignment) => (
          <div key={assignment.id} className="group flex items-start gap-2 text-sm">
            <button
              type="button"
              onClick={() => handleToggle(assignment)}
              className="mt-0.5 shrink-0"
            >
              <div className={`size-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                assignment.completed
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted-foreground/40 hover:border-primary"
              }`}>
                {assignment.completed && (
                  <svg className="size-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
            </button>
            <span className={`flex-1 ${assignment.completed ? "line-through text-muted-foreground" : ""}`}>
              {assignment.text}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(assignment.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 mt-0.5"
              title="Delete assignment"
            >
              <Trash2Icon className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
