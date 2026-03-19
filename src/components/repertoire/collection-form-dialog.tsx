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
  createCollection,
  updateCollection,
} from "@/app/(app)/repertoire/actions";
import type { Collection } from "@/lib/types";

export function CollectionFormDialog({
  collection,
  trigger,
}: {
  collection?: Collection;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const result = collection
      ? await updateCollection(collection.id, formData)
      : await createCollection(formData);

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
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<span />} nativeButton={false}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {collection ? "Edit Collection" : "Add Collection"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              name="name"
              required
              defaultValue={collection?.name ?? ""}
              placeholder="e.g. Goldberg Variations"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="collection-composer">Composer</Label>
            <Input
              id="collection-composer"
              name="composer"
              defaultValue={collection?.composer ?? ""}
              placeholder="e.g. J.S. Bach"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="collection-notes">Notes</Label>
            <Textarea
              id="collection-notes"
              name="notes"
              defaultValue={collection?.notes ?? ""}
              placeholder="Optional notes..."
              className="min-h-20"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving..."
                : collection
                  ? "Save Changes"
                  : "Add Collection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
