"use client";

import { useEffect, useState, useTransition } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Bold, Heading1, Heading2, Heading3, Italic, List, ListOrdered, Quote } from "lucide-react";
import { saveAgentFile } from "@/app/(journal)/journal/actions";
import { cn } from "@/lib/utils";
import type { JournalAgentFileName } from "@/lib/types";

function getMarkdown(editor: Editor): string {
  const md = (editor.storage as { markdown?: { getMarkdown?: () => string } }).markdown;
  return md?.getMarkdown?.() ?? "";
}

export function SingleFileEditor({
  name,
  initialMarkdown,
}: {
  name: JournalAgentFileName;
  initialMarkdown: string;
}) {
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: "Write…" }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: true,
        breaks: false,
      }),
    ],
    content: initialMarkdown,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-editor font-serif text-base focus:outline-none",
      },
    },
    onUpdate: () => {
      setDirty(true);
      if (justSaved) setJustSaved(false);
    },
  });

  // Switching tabs is handled by parent re-mount; this catches in-place updates.
  useEffect(() => {
    if (!editor) return;
    const current = getMarkdown(editor) ?? "";
    if (current !== initialMarkdown) {
      editor.commands.setContent(initialMarkdown, { emitUpdate: false });
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  function handleSave() {
    if (!editor) return;
    const md = getMarkdown(editor) ?? "";
    startTransition(async () => {
      try {
        await saveAgentFile(name, md);
        setDirty(false);
        setJustSaved(true);
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div>
      <Toolbar editor={editor} />
      <div className="agent-editor rounded-md border border-border bg-card p-4">
        <EditorContent editor={editor} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {justSaved ? "saved" : dirty ? "unsaved changes" : ""}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || pending}
          className="font-serif text-sm text-foreground underline-offset-4 hover:underline disabled:opacity-40 disabled:hover:no-underline"
        >
          {pending ? "saving…" : "save"}
        </button>
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return <div className="mt-4 mb-2 h-9" />;
  }
  return (
    <div className="mt-4 mb-2 flex flex-wrap items-center gap-1">
      <ToolButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        label="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        label="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolButton>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolButton>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Bullet list"
      >
        <List className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Ordered list"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="Quote"
      >
        <Quote className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded transition-colors",
        active
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
