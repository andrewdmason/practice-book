import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { InputRule } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AssignmentItemView } from "../assignment-item-view";

/**
 * Extended TaskItem that uses a numeric progress attribute (0-4) instead of
 * the built-in boolean checked. Renders via a custom React NodeView that
 * shows a ProgressCircle and handles click / option-click.
 */
export const CustomAssignmentItem = TaskItem.extend({
  addAttributes() {
    return {
      taskId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-task-id"),
        renderHTML: (attributes: { taskId: string | null }) => {
          if (!attributes.taskId) return {};
          return { "data-task-id": attributes.taskId };
        },
      },
      progress: {
        default: 0,
        parseHTML: (element: HTMLElement) => {
          // Backward compat: legacy checked attribute
          const checked = element.getAttribute("data-checked");
          if (checked === "true") return 4;
          const progress = element.getAttribute("data-progress");
          return progress ? parseInt(progress, 10) : 0;
        },
        renderHTML: (attributes: { progress: number }) => ({
          "data-progress": String(attributes.progress),
          // Keep data-checked for Tiptap internal CSS compat
          "data-checked": attributes.progress === 4 ? "true" : "false",
        }),
      },
      note: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-note") || null,
        renderHTML: (attributes: { note: string | null }) => {
          if (!attributes.note) return {};
          return { "data-note": attributes.note };
        },
      },
    };
  },

  addInputRules() {
    const parentRules = this.parent?.() ?? [];
    return [
      ...parentRules,
      // Also match "[]" followed by a space (without space inside brackets)
      new InputRule({
        find: /^\[\]\s$/,
        handler: ({ state, range }) => {
          const { tr } = state;
          tr.delete(range.from, range.to);

          const taskItemType = state.schema.nodes.taskItem;
          const taskListType = state.schema.nodes.taskList;

          if (taskItemType && taskListType) {
            const paragraph = state.schema.nodes.paragraph.create();
            const taskItem = taskItemType.create(
              { progress: 0, taskId: crypto.randomUUID() },
              paragraph
            );
            const taskList = taskListType.create(null, taskItem);
            tr.replaceWith(range.from, range.from, taskList);
            tr.setSelection(
              TextSelection.near(tr.doc.resolve(range.from + 3))
            );
          }
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor;
        const { $from } = state.selection;

        const taskItem = $from.node(-1)?.type.name === "taskItem" ? $from.node(-1) : null;
        if (!taskItem) return false;

        return this.editor.chain().splitBlock().liftListItem("taskItem").run();
      },
    };
  },

  // Auto-assign taskId on creation if not set
  onCreate() {
    const { doc, tr } = this.editor.state;
    let modified = false;
    doc.descendants((node, pos) => {
      if (node.type.name === "taskItem" && !node.attrs.taskId) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          taskId: crypto.randomUUID(),
        });
        modified = true;
      }
    });
    if (modified) {
      this.editor.view.dispatch(tr);
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(AssignmentItemView);
  },
});

export const CustomAssignmentList = TaskList.configure({
  HTMLAttributes: {
    class: "assignment-list",
  },
});

export { CustomAssignmentItem as AssignmentItemExtension, CustomAssignmentList as AssignmentListExtension };
