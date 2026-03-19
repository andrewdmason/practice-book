import { createClient } from "@/lib/supabase/server";
import { EditorDemoClient } from "./editor-demo-client";
import type { PieceSuggestion } from "@/lib/types";

export default async function EditorDemoPage() {
  const supabase = await createClient();

  // Fetch pieces for mention autocomplete
  const { data: pieces } = await supabase
    .from("pieces")
    .select("id, name, composer")
    .eq("status", "active")
    .order("name");

  // Create or get a demo lesson for testing saves
  const today = new Date().toISOString().split("T")[0];
  const { data: existingLesson } = await supabase
    .from("lessons")
    .select("id, content")
    .eq("date", today)
    .single();

  let lessonId: string;
  let lessonContent = null;

  if (existingLesson) {
    lessonId = existingLesson.id;
    lessonContent = existingLesson.content;
  } else {
    const { data: newLesson } = await supabase
      .from("lessons")
      .insert({ date: today })
      .select("id")
      .single();
    lessonId = newLesson!.id;
  }

  // Create or get a demo practice entry section
  let { data: existingEntry } = await supabase
    .from("practice_entries")
    .select("id")
    .eq("date", today)
    .single();

  if (!existingEntry) {
    const { data: newEntry } = await supabase
      .from("practice_entries")
      .insert({ date: today })
      .select("id")
      .single();
    existingEntry = newEntry;
  }

  const { data: existingSection } = await supabase
    .from("practice_entry_sections")
    .select("id, content")
    .eq("practice_entry_id", existingEntry!.id)
    .eq("category", "general")
    .single();

  let sectionId: string;
  let sectionContent = null;

  if (existingSection) {
    sectionId = existingSection.id;
    sectionContent = existingSection.content;
  } else {
    const { data: newSection } = await supabase
      .from("practice_entry_sections")
      .insert({
        practice_entry_id: existingEntry!.id,
        category: "general",
        sort_order: 0,
      })
      .select("id")
      .single();
    sectionId = newSection!.id;
  }

  return (
    <EditorDemoClient
      pieces={(pieces as PieceSuggestion[]) ?? []}
      lessonId={lessonId}
      lessonContent={lessonContent}
      sectionId={sectionId}
      sectionContent={sectionContent}
    />
  );
}
