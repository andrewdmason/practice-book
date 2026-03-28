"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPiece, updatePiece } from "@/app/(app)/repertoire/actions";
import type { Piece, Collection, PieceStatus } from "@/lib/types";
import { PIECE_STATUSES, PIECE_STATUS_LABELS } from "@/lib/types";

export function PieceFormDialog({
  piece,
  collections,
  trigger,
}: {
  piece?: Piece;
  collections: Collection[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<PieceStatus>(piece?.status ?? "active");
  const [collectionId, setCollectionId] = useState<string>(
    piece?.collection_id ?? ""
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("status", status);
    formData.set("collection_id", collectionId);

    const result = piece
      ? await updatePiece(piece.id, formData)
      : await createPiece(formData);

    setPending(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      // Reset form state when opening
      setStatus(piece?.status ?? "active");
      setCollectionId(piece?.collection_id ?? "");
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<span />} nativeButton={false}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{piece ? "Edit Piece" : "Add Piece"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="piece-name">Name</Label>
            <Input
              id="piece-name"
              name="name"
              required
              defaultValue={piece?.name ?? ""}
              placeholder="e.g. Scherzo No. 2 in B-flat minor"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="piece-composer">Composer</Label>
            <Input
              id="piece-composer"
              name="composer"
              defaultValue={piece?.composer ?? ""}
              placeholder="e.g. Chopin"
            />
          </div>
          {collections.length > 0 && (
            <div className="grid gap-2">
              <Label>Collection</Label>
              <Select value={collectionId} onValueChange={(v) => setCollectionId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None (standalone)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (standalone)</SelectItem>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PieceStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIECE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PIECE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="piece-notes">Notes</Label>
            <Textarea
              id="piece-notes"
              name="notes"
              defaultValue={piece?.notes ?? ""}
              placeholder="Optional notes..."
              className="min-h-20"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : piece ? "Save Changes" : "Add Piece"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
