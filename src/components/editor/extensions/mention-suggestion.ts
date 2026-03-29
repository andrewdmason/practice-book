import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import type { SuggestionOptions } from "@tiptap/suggestion";
import {
  SuggestionList,
  type SuggestionItem,
  type SuggestionListRef,
} from "../suggestion-list";

export function createMentionSuggestion(): Omit<SuggestionOptions<SuggestionItem>, "editor"> {
  return {
    char: "@",
    allowSpaces: false,

    items: ({ query }) => {
      // Show hint when query is empty (just typed @)
      if (query.length === 0) {
        return [
          {
            id: "tempo-hint",
            type: "hint" as const,
            title: "Type a tempo, e.g. @120",
          },
        ];
      }

      // Metronome marking for numeric queries
      if (/^\d+$/.test(query)) {
        return [
          {
            id: `tempo-${query}`,
            type: "metronome" as const,
            title: `♩=${query}`,
            subtitle: "Insert tempo marking",
            data: { bpm: parseInt(query, 10) },
          },
        ];
      }

      // Non-numeric text — dismiss the popup
      return [];
    },

    render: () => {
      let component: ReactRenderer<SuggestionListRef> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props) => {
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
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "metronomeMarking",
          attrs: { bpm: item.data?.bpm ?? 120 },
        })
        .run();
    },
  };
}
