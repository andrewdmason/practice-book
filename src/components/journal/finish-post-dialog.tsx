"use client";

import { Check, Lock, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JournalVisibility } from "@/lib/types";

/**
 * The "Finish post" confirmation: pick who can read the post (private or
 * family) before it's closed and dropped into the journal. Shared by the
 * AI-interview chat surface and the freeform blog composer so finishing a
 * post feels identical no matter how it was written.
 */
export function FinishPostDialog({
  open,
  onOpenChange,
  selectedVisibility,
  onSelectedVisibilityChange,
  hasUnsentReply,
  closing,
  onFinish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedVisibility: JournalVisibility;
  onSelectedVisibilityChange: (visibility: JournalVisibility) => void;
  hasUnsentReply: boolean;
  closing: boolean;
  onFinish: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-normal">
            Finish post
          </DialogTitle>
          <DialogDescription className="font-serif">
            Choose who can read this post before it goes into your journal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <VisibilityChoice
            active={selectedVisibility === "private"}
            icon={<Lock className="size-4" />}
            title="Keep personal"
            description="Only you can read it."
            onClick={() => onSelectedVisibilityChange("private")}
          />
          <VisibilityChoice
            active={selectedVisibility === "family"}
            icon={<Users className="size-4" />}
            title="Share with family"
            description="Family members can read it after you finish."
            onClick={() => onSelectedVisibilityChange("family")}
          />
        </div>

        {hasUnsentReply && (
          <p className="font-serif text-xs text-muted-foreground">
            The text currently in the reply box has not been sent and will not be
            included.
          </p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={closing}
            className="inline-flex h-9 items-center justify-center rounded-md px-3 font-serif text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onFinish}
            disabled={closing}
            className="inline-flex h-9 items-center justify-center rounded-md bg-foreground px-4 font-serif text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {closing ? "Finishing..." : "Finish post"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VisibilityChoice({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors " +
        (active
          ? "border-foreground/30 bg-foreground text-background"
          : "border-border hover:border-foreground/25 hover:bg-muted/40")
      }
    >
      <span
        className={
          "flex size-8 shrink-0 items-center justify-center rounded-full " +
          (active ? "bg-background/15" : "bg-muted text-muted-foreground")
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-sm">{title}</span>
        <span
          className={
            "block text-xs " +
            (active ? "text-background/70" : "text-muted-foreground")
          }
        >
          {description}
        </span>
      </span>
      {active && <Check className="size-4 shrink-0" aria-hidden />}
    </button>
  );
}
