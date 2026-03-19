"use client";

import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";

export function MetronomeMarkingView({ node }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 font-mono text-sm text-secondary-foreground"
        data-metronome={node.attrs.bpm}
      >
        ♩={node.attrs.bpm}
      </span>
    </NodeViewWrapper>
  );
}
