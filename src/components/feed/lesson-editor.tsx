"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import type { JSONContent } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { ZenModeProvider } from "@/components/layout/zen-mode-context";
import { saveEditorContent } from "@/app/(app)/editor/actions";
import type { PieceSuggestion } from "@/lib/types";

type LessonEditorProps = {
  lessonId: string;
  lessonDate: string;
  initialContent: JSONContent | null;
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
  initialContent,
  pieces,
}: LessonEditorProps) {
  const router = useRouter();

  const handleSave = useCallback(
    async (content: JSONContent) => {
      await saveEditorContent("lesson", lessonId, content);
    },
    [lessonId]
  );

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
          <h1 className="font-serif text-2xl font-bold">Lesson</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatLessonDate(lessonDate)}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <RichTextEditor
            context="lesson"
            sourceType="lesson"
            sourceId={lessonId}
            initialContent={initialContent}
            pieces={pieces}
            onSave={handleSave}
            placeholder="Write your lesson notes..."
          />
        </div>
      </div>
    </ZenModeProvider>
  );
}
