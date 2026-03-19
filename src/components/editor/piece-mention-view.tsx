"use client";

import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { Music } from "lucide-react";

export function PieceMentionView({ node }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-sm font-medium text-primary"
        data-piece-id={node.attrs.id}
        data-mention=""
      >
        <Music className="size-3" />
        {node.attrs.name}
      </span>
    </NodeViewWrapper>
  );
}
