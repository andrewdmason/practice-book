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
import { MasterySelector } from "./mastery-selector";
import { updatePieceStatus } from "@/app/(app)/repertoire/actions";
import type { MasteryLevel, Piece } from "@/lib/types";

export function ArchiveDialog({
  piece,
  open,
  onOpenChange,
}: {
  piece: Piece;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [masteryLevel, setMasteryLevel] = useState<MasteryLevel>(
    piece.mastery_level
  );
  const [pending, setPending] = useState(false);

  async function handleArchive() {
    setPending(true);
    await updatePieceStatus(piece.id, "archived", masteryLevel);
    setPending(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Archive &ldquo;{piece.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            Before archiving, you can update the mastery level for this piece.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <MasterySelector value={masteryLevel} onChange={setMasteryLevel} />
        </div>
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
