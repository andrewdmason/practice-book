import { Node } from "@tiptap/core";

/**
 * Read-only schema definitions for taskList/taskItem nodes that exist in
 * previously-saved editor content. These extensions let the editor parse the
 * old JSON without error; the nodes render as plain text (no checkboxes).
 *
 * Safe to remove once all stored content has been re-saved without task nodes.
 */

export const LegacyTaskList = Node.create({
  name: "taskList",
  group: "block",
  content: "taskItem+",

  parseHTML() {
    return [{ tag: "ul[data-type='taskList']" }];
  },

  renderHTML() {
    return ["ul", 0];
  },
});

export const LegacyTaskItem = Node.create({
  name: "taskItem",
  group: "block",
  content: "paragraph+",

  addAttributes() {
    return {
      taskId: { default: null },
      checked: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: "li[data-type='taskItem']" }];
  },

  renderHTML() {
    return ["li", 0];
  },
});
