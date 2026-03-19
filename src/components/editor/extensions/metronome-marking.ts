import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MetronomeMarkingView } from "../metronome-marking-view";

export const MetronomeMarking = Node.create({
  name: "metronomeMarking",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      bpm: { default: 120 },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-metronome]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-metronome": node.attrs.bpm,
        class: "metronome-marking",
      }),
      `♩=${node.attrs.bpm}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MetronomeMarkingView);
  },
});
