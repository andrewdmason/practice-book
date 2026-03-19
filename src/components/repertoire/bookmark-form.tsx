"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBookmark, updateBookmark } from "@/app/(app)/repertoire/actions";
import type { Bookmark } from "@/lib/types";

export function BookmarkForm({
  pieceId,
  bookmark,
  onDone,
}: {
  pieceId: string;
  bookmark?: Bookmark;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("piece_id", pieceId);

    const result = bookmark
      ? await updateBookmark(bookmark.id, formData)
      : await createBookmark(formData);

    setPending(false);

    if (result?.error) {
      setError(result.error);
    } else {
      onDone();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3"
    >
      <div className="grid gap-1 flex-1 min-w-[120px]">
        <Label htmlFor="bk-name" className="text-xs">
          Name
        </Label>
        <Input
          id="bk-name"
          name="name"
          required
          defaultValue={bookmark?.name ?? ""}
          placeholder="e.g. hard passage"
          className="h-7 text-sm"
        />
      </div>
      <div className="grid gap-1 w-20">
        <Label htmlFor="bk-start" className="text-xs">
          From
        </Label>
        <Input
          id="bk-start"
          name="measure_start"
          type="number"
          min={1}
          required
          defaultValue={bookmark?.measure_start ?? ""}
          className="h-7 text-sm"
        />
      </div>
      <div className="grid gap-1 w-20">
        <Label htmlFor="bk-end" className="text-xs">
          To
        </Label>
        <Input
          id="bk-end"
          name="measure_end"
          type="number"
          min={1}
          defaultValue={bookmark?.measure_end ?? ""}
          className="h-7 text-sm"
        />
      </div>
      <div className="flex gap-1">
        <Button type="submit" size="xs" disabled={pending}>
          {pending ? "..." : bookmark ? "Save" : "Add"}
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error && (
        <p className="w-full text-xs text-destructive">{error}</p>
      )}
    </form>
  );
}
