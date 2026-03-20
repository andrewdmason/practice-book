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

  // 1. Save content to the section
  {
    const { error } = await supabase
      .from("practice_entry_sections")
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

  // 3. Extract and sync tasks (preserve progress/completion state from DB)
  const tasks = extractTasks(content);

  // Look up the section's piece_id as fallback for task piece association
  let sectionPieceId: string | null = null;
  {
    const { data: section } = await supabase
      .from("practice_entry_sections")
      .select("piece_id")
      .eq("id", sourceId)
      .single();
    sectionPieceId = section?.piece_id ?? null;
  }

  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("id, progress, completed_at, note")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);

  const existingTaskMap = new Map(
    existingTasks?.map((t) => [t.id, t]) ?? []
  );

  await supabase
    .from("tasks")
    .delete()
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);

  if (tasks.length > 0) {
    const now = new Date().toISOString();
    const { error } = await supabase.from("tasks").insert(
      tasks.map((t) => {
        const existing = existingTaskMap.get(t.taskId);
        const progress = existing?.progress ?? t.progress;
        const completedAt =
          progress === 4
            ? (existing?.completed_at ?? now)
            : null;
        return {
          id: t.taskId,
          source_type: sourceType,
          source_id: sourceId,
          piece_id: t.pieceId ?? sectionPieceId,
          text: t.text,
          progress,
          completed_at: completedAt,
          note: existing?.note ?? null,
        };
      })
    );
    if (error) console.error("Failed to insert tasks:", error.message);
  }

  revalidatePath("/");
  return { success: true };
}
