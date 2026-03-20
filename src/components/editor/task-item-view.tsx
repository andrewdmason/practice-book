"use client";

import { useEffect, useState } from "react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ProgressCircle } from "@/components/ui/progress-circle";

export function TaskItemView({ node, updateAttributes }: NodeViewProps) {
  const progress: number = node.attrs.progress ?? 0;
  const taskId: string | null = node.attrs.taskId ?? null;
  const [displayNote, setDisplayNote] = useState<string | null>(node.attrs.note ?? null);

  // Listen for note updates from the side panel
  useEffect(() => {
    if (!taskId) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.taskId === taskId) {
        setDisplayNote(detail.note);
        updateAttributes({ note: detail.note });
      }
    };

    window.addEventListener("task-note-updated", handler);
    return () => window.removeEventListener("task-note-updated", handler);
  }, [taskId, updateAttributes]);

  // Sync when node attrs change externally
  useEffect(() => {
    setDisplayNote(node.attrs.note ?? null);
  }, [node.attrs.note]);

  const handleClick = (e: React.MouseEvent) => {
    if (e.altKey) {
      updateAttributes({ progress: (progress + 1) % 5 });
    } else {
      updateAttributes({ progress: progress === 4 ? 0 : 4 });
    }
  };

  return (
    <NodeViewWrapper
      as="li"
      className="task-item-node"
      data-task-id={taskId}
      data-progress={String(progress)}
      data-checked={progress === 4 ? "true" : "false"}
    >
      <label contentEditable={false} className="task-item-checkbox">
        <button
          type="button"
          onClick={handleClick}
          className="task-progress-btn"
        >
          <ProgressCircle progress={progress} size={16} />
        </button>
      </label>
      <div className="task-item-content">
        <NodeViewContent as="div" />
        {displayNote && (
          <p contentEditable={false} className="task-note-display">
            {displayNote}
          </p>
        )}
      </div>
    </NodeViewWrapper>
  );
}
