import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import type { SuggestionOptions } from "@tiptap/suggestion";
import {
  SuggestionList,
  type SuggestionItem,
  type SuggestionListRef,
} from "../suggestion-list";

export function createSlashCommandSuggestion(
  context: "practice_entry" | "lesson"
): Omit<SuggestionOptions<SuggestionItem>, "editor"> {
  return {
    char: "/",
    allowSpaces: false,
    startOfLine: true,

    items: ({ query }) => {
      const q = query.toLowerCase();
      const commands: SuggestionItem[] = [];

      if (context === "lesson") {
        commands.push({
          id: "goal",
          type: "command",
          title: "Goal",
          subtitle: "Add a lesson goal",
        });
      }

      return commands.filter((c) => c.title.toLowerCase().includes(q));
    },

    render: () => {
      let component: ReactRenderer<SuggestionListRef> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props) => {
          // Don't show popup if no items
          if (props.items.length === 0) return;

          component = new ReactRenderer(SuggestionList, {
            props: {
              items: props.items,
              command: props.command,
            },
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },

        onUpdate: (props) => {
          component?.updateProps({
            items: props.items,
            command: props.command,
          });

          if (popup?.[0] && props.clientRect) {
            popup[0].setProps({
              getReferenceClientRect: props.clientRect as () => DOMRect,
            });
          }
        },

        onKeyDown: (props) => {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },

        onExit: () => {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },

    command: ({ editor, range, props: item }) => {
      if (item.id === "goal") {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: "goalBlock",
            attrs: {
              goalId: crypto.randomUUID(),
              completed: false,
            },
          })
          .run();
      }
    },
  };
}
