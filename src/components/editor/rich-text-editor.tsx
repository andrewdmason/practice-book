"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Suggestion from "@tiptap/suggestion";
import { Extension, type JSONContent } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { BubbleToolbar } from "./bubble-toolbar";
import { PieceMention } from "./extensions/piece-mention";
import { MetronomeMarking } from "./extensions/metronome-marking";
import { GoalBlock } from "./extensions/goal-block";
import { TaskListExtension, TaskItemExtension } from "./extensions/inline-task";
import { createMentionSuggestion } from "./extensions/mention-suggestion";
import { createSlashCommandSuggestion } from "./extensions/slash-command";
import type { PieceSuggestion, SourceType } from "@/lib/types";

type EditorContext = "practice_entry" | "lesson";

type RichTextEditorProps = {
  context: EditorContext;
  sourceType: SourceType;
  sourceId: string;
  initialContent?: JSONContent | null;
  pieces: PieceSuggestion[];
  onSave?: (content: JSONContent) => Promise<void>;
  placeholder?: string;
  readOnly?: boolean;
};

// Create the mention suggestion as a standalone extension wrapping the Suggestion plugin
function createMentionExtension(pieces: PieceSuggestion[]) {
  const suggestion = createMentionSuggestion(pieces);

  return Extension.create({
    name: "mentionSuggestion",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          pluginKey: new PluginKey("mentionSuggestion"),
          ...suggestion,
        }),
      ];
    },
  });
}

function createSlashCommandExtension(context: EditorContext) {
  const suggestion = createSlashCommandSuggestion(context);

  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          pluginKey: new PluginKey("slashCommand"),
          ...suggestion,
        }),
      ];
    },
  });
}

export function RichTextEditor({
  context,
  sourceType,
  sourceId,
  initialContent,
  pieces,
  onSave,
  placeholder: placeholderText = "Start typing...",
  readOnly = false,
}: RichTextEditorProps) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  const extensions = [
    StarterKit.configure({
      heading: { levels: [2, 3] },
    }),
    Placeholder.configure({
      placeholder: placeholderText,
    }),
    PieceMention,
    MetronomeMarking,
    TaskListExtension,
    TaskItemExtension.configure({ nested: false }),
    createMentionExtension(pieces),
    ...(context === "lesson" ? [GoalBlock, createSlashCommandExtension(context)] : []),
  ];

  const editor = useEditor({
    extensions,
    content: initialContent || undefined,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: readOnly
          ? "prose-editor cursor-default"
          : "prose-editor focus:outline-none",
      },
    },
    onUpdate: readOnly
      ? undefined
      : ({ editor: e }) => {
          // Debounced auto-save
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          saveTimeoutRef.current = setTimeout(() => {
            // Ensure clean JSON for server action serialization
            void handleSave(JSON.parse(JSON.stringify(e.getJSON())));
          }, 1500);
        },
  });

  const handleSave = useCallback(
    async (content: JSONContent) => {
      if (isSavingRef.current || !onSave) return;
      isSavingRef.current = true;
      try {
        await onSave(content);
      } finally {
        isSavingRef.current = false;
      }
    },
    [onSave]
  );

  // Save on blur (skip in readOnly mode)
  useEffect(() => {
    if (!editor || !onSave || readOnly) return;

    const handleBlur = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      void handleSave(JSON.parse(JSON.stringify(editor.getJSON())));
    };

    editor.on("blur", handleBlur);
    return () => {
      editor.off("blur", handleBlur);
    };
  }, [editor, onSave, handleSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!editor) return null;

  return (
    <div className="rich-text-editor">
      {!readOnly && <BubbleToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
