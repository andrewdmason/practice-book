import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { InputRule } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

/**
 * Extended TaskItem that adds a taskId attribute for stable identity across saves.
 * Built-in TaskItem already handles [ ] and [x] input rules to create task items.
 * We add a custom [] input rule (without the space inside) plus auto-assign taskId on creation.
 */
export const CustomTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      taskId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-task-id"),
        renderHTML: (attributes: { taskId: string | null }) => {
          if (!attributes.taskId) return {};
          return { "data-task-id": attributes.taskId };
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
          // Delete the "[] " text
          tr.delete(range.from, range.to);

          // Use the built-in wrapInList approach: create an empty paragraph wrapped in task list
          const taskItemType = state.schema.nodes.taskItem;
          const taskListType = state.schema.nodes.taskList;

          if (taskItemType && taskListType) {
            const paragraph = state.schema.nodes.paragraph.create();
            const taskItem = taskItemType.create(
              { checked: false, taskId: crypto.randomUUID() },
              paragraph
            );
            const taskList = taskListType.create(null, taskItem);
            tr.replaceWith(range.from, range.from, taskList);
            // Set cursor inside the task item's paragraph
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
        // Instead of creating a new task item, exit the task list and create a paragraph
        const { state } = this.editor;
        const { $from } = state.selection;

        // Check if we're inside a taskItem
        const taskItem = $from.node(-1)?.type.name === "taskItem" ? $from.node(-1) : null;
        if (!taskItem) return false;

        // Split out of the task list into a new paragraph
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
});

export const CustomTaskList = TaskList.configure({
  HTMLAttributes: {
    class: "task-list",
  },
});

export { CustomTaskItem as TaskItemExtension, CustomTaskList as TaskListExtension };
