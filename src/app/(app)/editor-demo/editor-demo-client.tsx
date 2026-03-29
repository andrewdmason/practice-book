"use client";

import { useCallback } from "react";
import type { JSONContent } from "@tiptap/core";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { saveEditorContent } from "@/app/(app)/editor/actions";

type EditorDemoClientProps = {
  lessonId: string;
  lessonContent: JSONContent | null;
  sectionId: string;
  sectionContent: JSONContent | null;
};

export function EditorDemoClient({
  lessonId,
  lessonContent,
  sectionId,
  sectionContent,
}: EditorDemoClientProps) {
  const handleSaveSection = useCallback(
    async (content: JSONContent) => {
      await saveEditorContent("practice_entry", sectionId, content);
    },
    [sectionId]
  );

  const handleSaveLesson = useCallback(
    async (content: JSONContent) => {
      await saveEditorContent("practice_entry", lessonId, content);
    },
    [lessonId]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">Editor Demo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test the rich text editor with tasks and metronome markings.
        </p>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="mb-2 font-serif text-lg font-semibold">
            Practice Notes (General)
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Try: <code>@120</code> for metronome, <code>[]</code> for tasks
          </p>
          <div className="rounded-lg border bg-card p-4">
            <RichTextEditor
              context="practice_entry"
              sourceType="practice_entry"
              sourceId={sectionId}
              initialContent={sectionContent}
              onSave={handleSaveSection}
              placeholder="Write your practice notes..."
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-semibold">
            Lesson Notes
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            All features above, plus: <code>/goal</code> to add a lesson goal
          </p>
          <div className="rounded-lg border bg-card p-4">
            <RichTextEditor
              context="lesson"
              sourceType="practice_entry"
              sourceId={lessonId}
              initialContent={lessonContent}
              onSave={handleSaveLesson}
              placeholder="Write your lesson notes..."
            />
          </div>
        </section>
      </div>
    </div>
  );
}
