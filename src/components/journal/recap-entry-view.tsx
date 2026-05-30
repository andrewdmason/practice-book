"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  deleteEntry,
  updateRecapEntry,
} from "@/app/(journal)/journal/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function RecapEntryView({
  entryId,
  title,
  body,
  readOnly = false,
  afterTitle = null,
  menuActions = null,
}: {
  entryId: string;
  title: string;
  body: string;
  /** A family member viewing someone else's shared recap: no edit/delete. */
  readOnly?: boolean;
  afterTitle?: React.ReactNode;
  menuActions?: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [titleText, setTitleText] = useState(title);
  const [bodyText, setBodyText] = useState(body);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  function handleSave() {
    if (!bodyText.trim() || isSaving) return;
    setError(null);
    startSave(async () => {
      try {
        await updateRecapEntry(entryId, titleText, bodyText);
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleCancel() {
    if (isSaving) return;
    setTitleText(title);
    setBodyText(body);
    setError(null);
    setEditing(false);
  }

  if (readOnly) {
    return (
      <div className="mt-6">
        <h1 className="font-serif text-3xl leading-snug text-foreground">
          {title}
        </h1>
        {afterTitle}
        <RecapMarkdown body={body} />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mt-6">
        <input
          type="text"
          value={titleText}
          onChange={(e) => setTitleText(e.target.value)}
          placeholder="title"
          disabled={isSaving}
          className="w-full rounded-lg border border-muted bg-transparent px-5 py-3 font-serif text-2xl leading-snug text-foreground focus:border-foreground/40 focus:outline-none disabled:opacity-50"
        />
        <textarea
          autoFocus
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={16}
          disabled={isSaving}
          className="mt-4 w-full resize-none rounded-lg border border-muted bg-transparent px-5 py-4 font-serif text-base leading-relaxed text-foreground focus:border-foreground/40 focus:outline-none disabled:opacity-50"
        />
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex items-center gap-x-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={!bodyText.trim() || isSaving}
            className="font-serif text-sm text-foreground underline-offset-4 hover:underline disabled:opacity-40 disabled:hover:no-underline"
          >
            {isSaving ? "saving…" : "save"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40"
          >
            cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="group/recap flex items-start justify-between gap-2">
        <h1 className="font-serif text-3xl leading-snug text-foreground">
          {title}
        </h1>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Recap options"
            className="mt-1.5 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/recap:opacity-100 data-[popup-open]:opacity-100"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            {menuActions}
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil />
              Edit recap
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 />
              Delete recap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {afterTitle}

      <RecapMarkdown body={body} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this recap?</DialogTitle>
            <DialogDescription>
              This permanently deletes the recap. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() =>
                startDelete(async () => {
                  await deleteEntry(entryId);
                })
              }
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Read-only markdown render of the recap body, reusing the same Tiptap +
// tiptap-markdown setup and `.prose-editor` styling as the agent-file editor.
function RecapMarkdown({ body }: { body: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: true,
        breaks: false,
      }),
    ],
    content: body,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-editor font-serif text-base focus:outline-none",
      },
    },
  });

  // Keep the rendered content in sync after an edit + refresh.
  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(body, { emitUpdate: false });
  }, [editor, body]);

  return <div className="mt-6">{editor && <EditorContent editor={editor} />}</div>;
}
