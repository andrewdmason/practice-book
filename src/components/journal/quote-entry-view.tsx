"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  deleteEntry,
  updateQuoteEntry,
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

export function QuoteEntryView({
  entryId,
  quote,
  attribution,
  readOnly = false,
  afterTitle = null,
  menuActions = null,
}: {
  entryId: string;
  quote: string;
  attribution: string | null;
  /** A family member viewing someone else's shared quote: no edit/delete. */
  readOnly?: boolean;
  afterTitle?: React.ReactNode;
  menuActions?: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [quoteText, setQuoteText] = useState(quote);
  const [attributionText, setAttributionText] = useState(attribution ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  function handleSave() {
    if (!quoteText.trim() || isSaving) return;
    setError(null);
    startSave(async () => {
      try {
        await updateQuoteEntry(entryId, quoteText, attributionText);
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleCancel() {
    if (isSaving) return;
    setQuoteText(quote);
    setAttributionText(attribution ?? "");
    setError(null);
    setEditing(false);
  }

  if (readOnly) {
    return (
      <div className="mt-6">
        <blockquote className="font-serif text-3xl leading-snug text-foreground">
          <span className="mr-1 text-muted-foreground/50">“</span>
          {quote}
          <span className="ml-0.5 text-muted-foreground/50">”</span>
        </blockquote>
        {afterTitle}
        {attribution && (
          <p className="mt-4 font-serif text-base italic leading-relaxed text-muted-foreground">
            {attribution}
          </p>
        )}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mt-6">
        <textarea
          autoFocus
          value={quoteText}
          onChange={(e) => setQuoteText(e.target.value)}
          rows={4}
          disabled={isSaving}
          className="w-full resize-none rounded-lg border border-muted bg-transparent px-5 py-4 font-serif text-2xl leading-snug text-foreground focus:border-foreground/40 focus:outline-none disabled:opacity-50"
        />
        <input
          type="text"
          value={attributionText}
          onChange={(e) => setAttributionText(e.target.value)}
          placeholder="— who / context (optional)"
          disabled={isSaving}
          className="mt-4 w-full rounded-lg border border-muted bg-transparent px-5 py-3 font-serif text-base leading-relaxed text-muted-foreground placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:outline-none disabled:opacity-50"
        />
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex items-center gap-x-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={!quoteText.trim() || isSaving}
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
      <div className="group/quote flex items-start gap-2">
        <blockquote className="font-serif text-3xl leading-snug text-foreground">
          <span className="mr-1 text-muted-foreground/50">“</span>
          {quote}
          <span className="ml-0.5 text-muted-foreground/50">”</span>
        </blockquote>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Quote options"
            className="mt-1.5 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/quote:opacity-100 data-[popup-open]:opacity-100"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            {menuActions}
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil />
              Edit quote
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 />
              Delete quote
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {afterTitle}

      {attribution && (
        <p className="mt-4 font-serif text-base italic leading-relaxed text-muted-foreground">
          {attribution}
        </p>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this quote?</DialogTitle>
            <DialogDescription>
              This permanently deletes the quote. This can&apos;t be undone.
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
