import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LessonEditor } from "@/components/feed/lesson-editor";
import type { PieceSuggestion } from "@/lib/types";

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, date, content")
    .eq("id", id)
    .single();

  if (!lesson) notFound();

  const { data: pieces } = await supabase
    .from("pieces")
    .select("id, name, composer")
    .eq("status", "active")
    .order("name");

  return (
    <LessonEditor
      lessonId={lesson.id}
      lessonDate={lesson.date}
      initialContent={lesson.content}
      pieces={(pieces as PieceSuggestion[]) ?? []}
    />
  );
}
