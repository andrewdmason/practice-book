import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LessonEditor } from "@/components/feed/lesson-editor";
import type { PieceSuggestion, PracticeEntrySection, EntrySectionCategory } from "@/lib/types";

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("practice_entries")
    .select("id, date, type")
    .eq("id", id)
    .eq("type", "lesson")
    .single();

  if (!lesson) notFound();

  const { data: sections } = await supabase
    .from("practice_entry_sections")
    .select("id, practice_entry_id, piece_id, category, content, sort_order, pieces(name, composer)")
    .eq("practice_entry_id", lesson.id)
    .order("sort_order");

  const mappedSections: PracticeEntrySection[] = (sections ?? []).map((s) => ({
    id: s.id,
    practice_entry_id: s.practice_entry_id,
    piece_id: s.piece_id,
    category: s.category as EntrySectionCategory,
    content: s.content,
    sort_order: s.sort_order,
    piece_name: (s.pieces as unknown as { name: string; composer: string | null } | null)?.name ?? null,
    composer: (s.pieces as unknown as { name: string; composer: string | null } | null)?.composer ?? null,
  }));

  const { data: pieces } = await supabase
    .from("pieces")
    .select("id, name, composer")
    .eq("status", "active")
    .order("name");

  return (
    <LessonEditor
      lessonId={lesson.id}
      lessonDate={lesson.date}
      sections={mappedSections}
      pieces={(pieces as PieceSuggestion[]) ?? []}
    />
  );
}
