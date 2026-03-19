"use client";

import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { useMetronome } from "@/components/metronome/metronome-context";

export function MetronomeMarkingView({ node }: ReactNodeViewProps) {
  const { start } = useMetronome();

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 font-mono text-sm text-secondary-foreground cursor-pointer hover:bg-secondary/80 transition-colors"
        data-metronome={node.attrs.bpm}
        onClick={(e) => {
          e.preventDefault();
          (document.activeElement as HTMLElement)?.blur();
          start(node.attrs.bpm);
        }}
        role="button"
        tabIndex={0}
      >
        ♩={node.attrs.bpm}
      </span>
    </NodeViewWrapper>
  );
}
