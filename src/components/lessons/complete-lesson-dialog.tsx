"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeLesson } from "@/app/practice/lessons/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function CompleteLessonDialog({
  open,
  onOpenChange,
  lessonId,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string;
  defaultDate: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleConfirm = () => {
    startTransition(async () => {
      const newUpcomingId = await completeLesson(lessonId, date);
      onOpenChange(false);
      router.push(`/practice/lessons/${newUpcomingId}`);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete lesson</DialogTitle>
          <DialogDescription>
            Pick the date this lesson happened. A new upcoming lesson will be
            created for your next session.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="lesson-date">
            Lesson date
          </label>
          <input
            id="lesson-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={pending || !date}>
            {pending ? "Completing..." : "Complete lesson"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
