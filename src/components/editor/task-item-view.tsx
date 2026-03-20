"use client";

import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ProgressCircle } from "@/components/ui/progress-circle";

export function TaskItemView({ node, updateAttributes }: NodeViewProps) {
  const progress: number = node.attrs.progress ?? 0;

  const handleClick = (e: React.MouseEvent) => {
    if (e.altKey) {
      // Option-click: cycle 0→1→2→3→4→0
      updateAttributes({ progress: (progress + 1) % 5 });
    } else {
      // Normal click: toggle between 0 and 4
      updateAttributes({ progress: progress === 4 ? 0 : 4 });
    }
  };

  return (
    <NodeViewWrapper
      as="li"
      className="task-item-node"
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
      </div>
    </NodeViewWrapper>
  );
}
