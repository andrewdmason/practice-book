"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZenModeProvider } from "@/components/layout/zen-mode-context";
import { FeedSection } from "./feed-section";
import { AddSectionButton } from "./add-section-button";
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
              isToday={true}
              pieces={pieces}
              editorContext="lesson"
            />
          ))}
        </div>
      </div>
    </ZenModeProvider>
  );
}
