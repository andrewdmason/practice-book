"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { JournalInlineCommentWithAuthor } from "@/lib/types";
import { AddCommentTarget } from "@/components/journal/add-comment-target";
import { InlineCommentComposer } from "@/components/journal/inline-comment-composer";

/**
 * The stack of comments anchored to one block, in chronological order, each
 * styled as a note from that family member. A hover-reveal target at the bottom
 * adds another comment at the same anchor — which reads as a reply.
 */
export function InlineCommentThread({
  comments,
  currentUserId,
  isOwner,
  onAdd,
  onEdit,
  onDelete,
}: {
  comments: JournalInlineCommentWithAuthor[];
  currentUserId: string;
  isOwner: boolean;
  onAdd: (text: string) => Promise<void>;
  onEdit: (commentId: string, text: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}) {
  return (
    <div className="mt-3 space-y-2">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          canEdit={comment.user_id === currentUserId}
          canDelete={comment.user_id === currentUserId || isOwner}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
      <AddCommentTarget onAdd={onAdd} />
    </div>
  );
}

function CommentItem({
  comment,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  comment: JournalInlineCommentWithAuthor;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (commentId: string, text: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="group/comment rounded-md bg-muted/40 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-serif text-xs font-medium text-foreground/70">
          {comment.authorName}
        </span>
        {!editing && (canEdit || canDelete) && (
          <span className="flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/comment:opacity-100">
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit comment"
                title="Edit comment"
                className="text-muted-foreground/50 transition-colors hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => void onDelete(comment.id)}
                aria-label="Delete comment"
                title="Delete comment"
                className="text-muted-foreground/50 transition-colors hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </span>
        )}
      </div>
      {editing ? (
        <div className="mt-1">
          <InlineCommentComposer
            initialValue={comment.content}
            submitLabel="Save"
            onSubmit={async (text) => {
              await onEdit(comment.id, text);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap font-serif text-base leading-relaxed text-foreground/90">
          {comment.content}
        </p>
      )}
    </div>
  );
}
