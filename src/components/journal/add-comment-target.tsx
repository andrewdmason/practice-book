"use client";

import { useState } from "react";
import { InlineCommentComposer } from "@/components/journal/inline-comment-composer";

/**
 * The hover-reveal "add a comment here" affordance that sits between content
 * blocks (and beneath an existing comment, to reply in place). At rest it's
 * invisible; hovering the gap reveals a hairline with a "+ comment" label.
 * Clicking opens an inline composer in its place.
 */
export function AddCommentTarget({
  label = "comment",
  onAdd,
}: {
  label?: string;
  /** Persist the new comment; throw to keep the composer open with an error. */
  onAdd: (text: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="py-1">
        <InlineCommentComposer
          onSubmit={async (text) => {
            await onAdd(text);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Add a comment here"
      className="group/add flex w-full items-center gap-2 py-1 text-muted-foreground"
    >
      <span className="h-px flex-1 bg-border opacity-0 transition-opacity group-hover/add:opacity-100" />
      <span className="font-serif text-xs opacity-0 transition-opacity group-hover/add:opacity-100">
        + {label}
      </span>
      <span className="h-px flex-1 bg-border opacity-0 transition-opacity group-hover/add:opacity-100" />
    </button>
  );
}
