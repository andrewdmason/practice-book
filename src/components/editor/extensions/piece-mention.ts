import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PieceMentionView } from "../piece-mention-view";

export const PieceMention = Node.create({
  name: "pieceMention",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
      name: { default: null },
      composer: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-piece-id]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-piece-id": node.attrs.id,
        "data-mention": "",
        class: "piece-mention",
      }),
      `@${node.attrs.name}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PieceMentionView);
  },
});
