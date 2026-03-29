"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ZenModeProvider } from "@/components/layout/zen-mode-context";
import { FeedSection } from "./feed-section";
import { AddSectionButton } from "./add-section-button";
import { deleteLesson } from "@/app/(app)/feed/actions";
import type { PracticeEntrySection, PieceSuggestion } from "@/lib/types";

type LessonEditorProps = {
  lessonId: string;
  lessonDate: string;
  sections: PracticeEntrySection[];
  pieces: PieceSuggestion[];
};

function formatLessonDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function LessonEditor({
  lessonId,
  lessonDate,
  sections,
  pieces,
}: LessonEditorProps) {
  const router = useRouter();

  const sortedSections = [...sections].sort((a, b) => {
    const order = { technique: 0, sight_reading: 1, piece: 2, general: 3 };
    return (order[a.category] ?? 2) - (order[b.category] ?? 2);
  });

  return (
    <ZenModeProvider>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-3 -ml-2"
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </Button>
          <div className="group/header flex items-center gap-2">
            <h1 className="font-serif text-2xl font-bold">Lesson</h1>
            <AddSectionButton
              entryId={lessonId}
              existingSections={sections}
              pieces={pieces}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 opacity-0 group-hover/header:opacity-100 transition-opacity"
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={async () => {
                    await deleteLesson(lessonId);
                    router.back();
                  }}
                >
                  <Trash2Icon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatLessonDate(lessonDate)}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-2">
          {sortedSections.map((section) => (
            <FeedSection
              key={section.id}
              section={section}
              date={lessonDate}
              isToday={true}
              editorContext="lesson"
            />
          ))}
        </div>
      </div>
    </ZenModeProvider>
  );
}
