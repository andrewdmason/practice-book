"use client";

import { useState } from "react";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookmarkForm } from "./bookmark-form";
import { deleteBookmark } from "@/app/(app)/repertoire/actions";
import type { Bookmark } from "@/lib/types";

function formatMeasures(bookmark: Bookmark) {
  if (bookmark.measure_end) {
    return `mm. ${bookmark.measure_start}\u2013${bookmark.measure_end}`;
  }
  return `m. ${bookmark.measure_start}`;
}

export function BookmarkList({
  pieceId,
  bookmarks,
}: {
  pieceId: string;
  bookmarks: Bookmark[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Bookmarks</h3>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setAdding(true)}
          disabled={adding}
        >
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </div>

      {bookmarks.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">No bookmarks yet.</p>
      )}

      <div className="space-y-1">
        {bookmarks.map((bk) =>
          editingId === bk.id ? (
            <BookmarkForm
              key={bk.id}
              pieceId={pieceId}
              bookmark={bk}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <div
              key={bk.id}
              className="group flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{bk.name}</span>
                <span className="text-muted-foreground">
                  {formatMeasures(bk)}
                </span>
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setEditingId(bk.id)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => deleteBookmark(bk.id, pieceId)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          )
        )}

        {adding && (
          <BookmarkForm pieceId={pieceId} onDone={() => setAdding(false)} />
        )}
      </div>
    </div>
  );
}
