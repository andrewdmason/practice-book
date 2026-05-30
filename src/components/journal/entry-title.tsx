"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import {
  deleteEntry,
  regenerateEntryWrap,
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

export function EntryTitle({
  entryId,
  title,
  readOnly = false,
}: {
  entryId: string;
  title: string;
  /** A family member viewing someone else's shared entry: title only, no edit
   * or delete affordances. */
  readOnly?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isRegenerating, startRegenerate] = useTransition();
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  if (readOnly) {
    return (
      <h1 className="mt-2 font-serif text-3xl leading-tight text-foreground">
        {title}
      </h1>
    );
  }

  return (
    <div className="mt-2">
      <div className="group/title flex items-start gap-2">
        <h1 className="font-serif text-3xl leading-tight text-foreground">
          {isRegenerating ? "summing up…" : title}
        </h1>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Post options"
            className="mt-1.5 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/title:opacity-100 data-[popup-open]:opacity-100"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-36">
            <DropdownMenuItem
              disabled={isRegenerating}
              onClick={() => {
                setRegenerateError(null);
                startRegenerate(async () => {
                  try {
                    await regenerateEntryWrap(entryId);
                  } catch (err) {
                    setRegenerateError(
                      err instanceof Error ? err.message : String(err)
                    );
                  }
                });
              }}
            >
              <RefreshCw />
              Regenerate summary
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 />
              Delete post
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {regenerateError && (
        <p className="mt-2 text-sm text-destructive">
          Couldn&apos;t regenerate: {regenerateError}
        </p>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              This permanently deletes the entry and its conversation. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await deleteEntry(entryId);
                })
              }
            >
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
