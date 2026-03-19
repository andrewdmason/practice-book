"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractMentions } from "@/components/editor/lib/extract-mentions";
import { extractTasks } from "@/components/editor/lib/extract-tasks";
import type { JSONContent } from "@tiptap/core";
import type { SourceType } from "@/lib/types";

export async function saveEditorContent(
  sourceType: SourceType,
  sourceId: string,
  content: JSONContent
) {
  const supabase = await createClient();

  // 1. Save content to the source table
  if (sourceType === "practice_entry") {
    const { error } = await supabase
      .from("practice_entry_sections")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", sourceId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("lessons")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", sourceId);
    if (error) return { error: error.message };
  }

  // 2. Extract and sync mentions
  const mentions = extractMentions(content);
  await supabase
    .from("mentions")
    .delete()
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);

  if (mentions.length > 0) {
    const { error } = await supabase.from("mentions").insert(
      mentions.map((m) => ({
        piece_id: m.pieceId,
        source_type: sourceType,
        source_id: sourceId,
        context_snippet: m.contextSnippet,
      }))
    );
    if (error) console.error("Failed to insert mentions:", error.message);
  }

  // 3. Extract and sync tasks + goal blocks (preserve completed state from DB)
  const tasks = extractTasks(content);

  // For practice entry sections, look up the section's piece_id as fallback
  let sectionPieceId: string | null = null;
  if (sourceType === "practice_entry") {
    const { data: section } = await supabase
      .from("practice_entry_sections")
      .select("piece_id")
      .eq("id", sourceId)
      .single();
    sectionPieceId = section?.piece_id ?? null;
  }

  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("id, completed")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);

  const existingCompletedMap = new Map(
    existingTasks?.map((t) => [t.id, t.completed]) ?? []
  );

  await supabase
    .from("tasks")
    .delete()
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);

  if (tasks.length > 0) {
    const { error } = await supabase.from("tasks").insert(
      tasks.map((t) => ({
        id: t.taskId,
        source_type: sourceType,
        source_id: sourceId,
        piece_id: t.pieceId ?? sectionPieceId,
        text: t.text,
        completed: existingCompletedMap.get(t.taskId) ?? t.completed,
        style: t.style,
      }))
    );
    if (error) console.error("Failed to insert tasks:", error.message);
  }

  revalidatePath("/");
  return { success: true };
}
