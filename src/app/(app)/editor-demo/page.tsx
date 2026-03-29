import { createClient } from "@/lib/supabase/server";
import { EditorDemoClient } from "./editor-demo-client";

export default async function EditorDemoPage() {
  const supabase = await createClient();

  // Create or get a demo lesson entry for testing saves
  const today = new Date().toISOString().split("T")[0];
  const { data: existingLesson } = await supabase
    .from("practice_entries")
    .select("id")
    .eq("date", today)
    .eq("type", "lesson")
    .single();

  let lessonEntryId: string;

  if (existingLesson) {
    lessonEntryId = existingLesson.id;
  } else {
    const { data: newEntry } = await supabase
      .from("practice_entries")
      .insert({ date: today, type: "lesson" })
      .select("id")
      .single();
    lessonEntryId = newEntry!.id;
  }

  // Get the general section of the lesson entry
  let { data: lessonSection } = await supabase
    .from("practice_entry_sections")
    .select("id, content")
    .eq("practice_entry_id", lessonEntryId)
    .eq("category", "general")
    .single();

  if (!lessonSection) {
    const { data: newSection } = await supabase
      .from("practice_entry_sections")
      .insert({
        practice_entry_id: lessonEntryId,
        category: "general",
        sort_order: 0,
      })
      .select("id, content")
      .single();
    lessonSection = newSection;
  }

  // Create or get a demo practice entry section
  let { data: existingEntry } = await supabase
    .from("practice_entries")
    .select("id")
    .eq("date", today)
    .eq("type", "practice")
    .single();

  if (!existingEntry) {
    const { data: newEntry } = await supabase
      .from("practice_entries")
      .insert({ date: today, type: "practice" })
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
      lessonId={lessonSection!.id}
      lessonContent={lessonSection!.content}
      sectionId={sectionId}
      sectionContent={sectionContent}
    />
  );
}
