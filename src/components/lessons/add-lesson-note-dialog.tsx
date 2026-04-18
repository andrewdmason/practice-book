"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addNoteToUpcomingLesson } from "@/app/(app)/lessons/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function AddLessonNoteDialog({
  open,
  onOpenChange,
  pieceId,
  pieceName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pieceId: string;
  pieceName: string;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await addNoteToUpcomingLesson(pieceId, trimmed);
      onOpenChange(false);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Note for next lesson</DialogTitle>
          <DialogDescription>
            Add a quick note about {pieceName} to your upcoming lesson.
          </DialogDescription>
        </DialogHeader>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Ask about fingering in m. 42..."
          rows={4}
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !text.trim()}>
            {pending ? "Adding..." : "Add to lesson"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
