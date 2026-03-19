"use client";

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { Target } from "lucide-react";

export function GoalBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  const completed = node.attrs.completed as boolean;

  return (
    <NodeViewWrapper
      className={`my-2 flex items-start gap-2 rounded-md border-l-4 p-3 ${
        completed
          ? "border-muted bg-muted/30"
          : "border-primary bg-primary/5"
      }`}
    >
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
        <input
          type="checkbox"
          checked={completed}
          onChange={(e) => updateAttributes({ completed: e.target.checked })}
          className="size-4 rounded border-input accent-primary"
        />
        <Target className="size-4 text-primary" />
      </div>
      <NodeViewContent
        className={`flex-1 outline-none ${completed ? "text-muted-foreground line-through" : ""}`}
      />
    </NodeViewWrapper>
  );
}
