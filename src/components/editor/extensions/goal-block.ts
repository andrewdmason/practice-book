import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { GoalBlockView } from "../goal-block-view";

export const GoalBlock = Node.create({
  name: "goalBlock",
  group: "block",
  content: "inline*",

  addAttributes() {
    return {
      goalId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-goal-id"),
        renderHTML: (attributes: { goalId: string | null }) => ({
          "data-goal-id": attributes.goalId,
        }),
      },
      completed: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-completed") === "true",
        renderHTML: (attributes: { completed: boolean }) => ({
          "data-completed": String(attributes.completed),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-goal-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-goal-block": "" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GoalBlockView);
  },
});
