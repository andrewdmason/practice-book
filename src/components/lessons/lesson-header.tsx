"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useLessonView } from "./lesson-view-context";
import { LessonViewToggle } from "./lesson-view-toggle";
import { CompleteLessonDialog } from "./complete-lesson-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { reopenLesson } from "@/app/practice/lessons/actions";
import { cn } from "@/lib/utils";
import { localDate } from "@/lib/date-utils";

function formatLessonDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function LessonHeader() {
  const { lesson, neighbors, index, lessonNumber } = useLessonView();
  const router = useRouter();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [pendingReopen, startReopen] = useTransition();

  const isUpcoming = !lesson.completed_at;
  const today = localDate(new Date());

  const handleNav = (id: string | null) => {
    if (!id) return;
    router.push(`/practice/lessons/${id}`);
  };

  const handleReopen = () => {
    startReopen(async () => {
      await reopenLesson(lesson.id);
      router.push(`/practice/lessons/${lesson.id}`);
      router.refresh();
    });
  };

  return (
    <div className="mb-6 flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleNav(neighbors.prevId)}
          disabled={!neighbors.prevId}
          title="Previous lesson"
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleNav(neighbors.nextId)}
          disabled={!neighbors.nextId}
          title="Next lesson"
        >
          <ChevronRightIcon />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted transition-colors">
            <h1 className="text-2xl font-semibold tracking-tight">
              Lesson {lessonNumber}
            </h1>
            <span
              className={cn(
                "text-sm",
                isUpcoming ? "text-primary" : "text-muted-foreground"
              )}
            >
              · {isUpcoming ? "Upcoming" : formatLessonDate(lesson.date!)}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            {index
              .slice()
              .reverse()
              .map((l, idx) => {
                const num = index.length - idx;
                const isCurrent = l.id === lesson.id;
                return (
                  <DropdownMenuItem
                    key={l.id}
                    onClick={() => handleNav(l.id)}
                    className={cn(isCurrent && "bg-accent")}
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-sm">Lesson {num}</span>
                      <span className="text-xs text-muted-foreground">
                        {l.completed_at && l.date
                          ? formatShortDate(l.date)
                          : "Upcoming"}
                      </span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        {isUpcoming ? (
          <Button onClick={() => setCompleteOpen(true)}>
            <CheckCircle2Icon />
            Complete lesson
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReopen}
            disabled={pendingReopen}
          >
            <RotateCcwIcon />
            Mark as upcoming
          </Button>
        )}
        <LessonViewToggle mode="single" />
      </div>

      <CompleteLessonDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        lessonId={lesson.id}
        defaultDate={today}
      />
    </div>
  );
}
