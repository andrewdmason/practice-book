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
  createWork,
  updateWork,
} from "@/app/practice/repertoire/actions";
import type { Work } from "@/lib/types";

export function WorkFormDialog({
  work,
  trigger,
}: {
  work?: Work;
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

    const result = work
      ? await updateWork(work.id, formData)
      : await createWork(formData);

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
            {work ? "Edit Work" : "Add Work"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="work-name">Name</Label>
            <Input
              id="work-name"
              name="name"
              required
              defaultValue={work?.name ?? ""}
              placeholder="e.g. Goldberg Variations"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="work-composer">Composer</Label>
            <Input
              id="work-composer"
              name="composer"
              defaultValue={work?.composer ?? ""}
              placeholder="e.g. J.S. Bach"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="work-notes">Notes</Label>
            <Textarea
              id="work-notes"
              name="notes"
              defaultValue={work?.notes ?? ""}
              placeholder="Optional notes..."
              className="min-h-20"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving..."
                : work
                  ? "Save Changes"
                  : "Add Work"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
