"use client";

import { useEffect, useState, useTransition } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Bold, Heading1, Heading2, Heading3, Italic, List, ListOrdered, Quote } from "lucide-react";
import { saveAgentFile } from "@/app/(journal)/journal/actions";
import { cn } from "@/lib/utils";
import type { JournalAgentFile, JournalAgentFileName } from "@/lib/types";

const TAB_ORDER: JournalAgentFileName[] = ["Interviewer", "Me"];

const TAB_DESCRIPTIONS: Record<JournalAgentFileName, string> = {
  Interviewer:
    "The interviewer's voice, how it asks questions, and what kinds of questions land. Tune directly or by chatting with the agent (header icon).",
  Me: "Your life context: who you are, who's around you, what you're working on.",
};

export function AgentFileEditor({
  files,
}: {
  files: JournalAgentFile[];
}) {
  const [active, setActive] = useState<JournalAgentFileName>("Me");
  const fileMap = Object.fromEntries(files.map((f) => [f.name, f.content])) as Record<
    JournalAgentFileName,
    string
  >;
  const recentEdits = [...files]
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 3);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_240px]">
      <div>
        <div className="flex items-center gap-1 border-b border-border">
          {TAB_ORDER.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActive(name)}
              className={
                "relative px-3 py-2 font-serif text-sm transition-colors " +
                (active === name
                  ? "text-foreground after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2px] after:bg-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {name}.md
            </button>
          ))}
        </div>

        <p className="mt-3 font-serif text-xs italic text-muted-foreground">
          {TAB_DESCRIPTIONS[active]}
        </p>

        {/* Re-mount the editor when the active tab changes so initial content
            loads correctly per file. */}
        <SingleFileEditor
          key={active}
          name={active}
          initialMarkdown={fileMap[active] ?? ""}
        />
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <h2 className="font-serif text-sm uppercase tracking-wide text-muted-foreground">
          Recent file edits
        </h2>
        <ul className="mt-3 space-y-3">
          {recentEdits.map((f) => (
            <li key={f.id} className="font-serif text-sm">
              <span className="block text-xs text-muted-foreground tabular-nums">
                {f.updated_at.slice(0, 10)}
              </span>
              <span className="text-foreground">{f.name}.md</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 font-serif text-xs italic text-muted-foreground">
          Edits made via the agent chat sidebar (or here directly) update these timestamps.
        </p>
      </aside>
    </div>
  );
}

function getMarkdown(editor: Editor): string {
  const md = (editor.storage as { markdown?: { getMarkdown?: () => string } }).markdown;
  return md?.getMarkdown?.() ?? "";
}

function SingleFileEditor({
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
