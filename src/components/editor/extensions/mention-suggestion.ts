import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import type { SuggestionOptions } from "@tiptap/suggestion";
import {
  SuggestionList,
  type SuggestionItem,
  type SuggestionListRef,
} from "../suggestion-list";
import type { PieceSuggestion } from "@/lib/types";

export function createMentionSuggestion(
  pieces: PieceSuggestion[]
): Omit<SuggestionOptions<SuggestionItem>, "editor"> {
  return {
    char: "@",
    allowSpaces: false,

    items: ({ query }) => {
      const q = query.toLowerCase();

      // If query is purely numeric, suggest a metronome marking
      if (/^\d+$/.test(query) && query.length > 0) {
        return [
          {
            id: `tempo-${query}`,
            type: "metronome" as const,
            title: `♩=${query}`,
            subtitle: "Set tempo",
            data: { bpm: parseInt(query, 10) },
          },
        ];
      }

      // Otherwise, filter pieces
      return pieces
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.composer && p.composer.toLowerCase().includes(q))
        )
        .slice(0, 8)
        .map((p) => ({
          id: p.id,
          type: "piece" as const,
          title: p.name,
          subtitle: p.composer,
          data: { id: p.id, name: p.name, composer: p.composer },
        }));
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
      if (item.type === "metronome") {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: "metronomeMarking",
            attrs: { bpm: item.data?.bpm ?? 120 },
          })
          .run();
      } else {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: "pieceMention",
            attrs: {
              id: item.data?.id,
              name: item.data?.name,
              composer: item.data?.composer,
            },
          })
          .run();
      }
    },
  };
}
