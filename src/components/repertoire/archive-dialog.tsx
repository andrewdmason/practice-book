"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updatePieceStatus } from "@/app/practice/repertoire/actions";
import type { Piece } from "@/lib/types";

export function ArchiveDialog({
  piece,
  open,
  onOpenChange,
}: {
  piece: Piece;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleArchive() {
    setPending(true);
    await updatePieceStatus(piece.id, "archived");
    setPending(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Archive &ldquo;{piece.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            This piece will be moved to the archived tab.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleArchive} disabled={pending}>
            {pending ? "Archiving..." : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
