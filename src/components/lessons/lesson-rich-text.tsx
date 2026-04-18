"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { wrappingInputRule } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { useEffect, useRef } from "react";

const TaskListWithShortcut = TaskList.extend({
  addInputRules() {
    return [
      wrappingInputRule({
        find: /^\s*\[\]\s$/,
        type: this.type,
      }),
    ];
  },
});

export function LessonRichText({
  initialHtml,
  placeholder = "Notes...",
  onSave,
  onFocus,
}: {
  initialHtml: string;
  placeholder?: string;
  onSave: (html: string) => void | Promise<void>;
  onFocus?: () => void;
}) {
  const latestHtmlRef = useRef<string>(initialHtml);
  const savedRef = useRef<string>(initialHtml);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSave = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const html = latestHtmlRef.current;
    if (html === savedRef.current) return;
    savedRef.current = html;
    void onSave(html);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder }),
      TaskListWithShortcut,
      TaskItem.configure({ nested: true }),
    ],
    content: initialHtml || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-editor text-sm focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      latestHtmlRef.current = editor.getHTML();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flushSave, 1500);
    },
    onFocus: () => {
      onFocus?.();
    },
    onBlur: () => {
      flushSave();
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        flushSave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <EditorContent editor={editor} />;
}
