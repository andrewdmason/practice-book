"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractMentions } from "@/components/editor/lib/extract-mentions";
import { extractTasks } from "@/components/editor/lib/extract-tasks";
import { extractGoals } from "@/components/editor/lib/extract-goals";
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

  // 3. Extract and sync tasks (preserve completed state from DB)
  const tasks = extractTasks(content);
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
        piece_id: t.pieceId,
        text: t.text,
        completed: existingCompletedMap.get(t.taskId) ?? t.completed,
      }))
    );
    if (error) console.error("Failed to insert tasks:", error.message);
  }

  // 4. Extract and sync goals (lesson only)
  if (sourceType === "lesson") {
    const goals = extractGoals(content);
    const { data: existingGoals } = await supabase
      .from("goals")
      .select("id, completed, note")
      .eq("lesson_id", sourceId);

    const existingGoalMap = new Map(
      existingGoals?.map((g) => [g.id, { completed: g.completed, note: g.note }]) ?? []
    );

    await supabase.from("goals").delete().eq("lesson_id", sourceId);

    if (goals.length > 0) {
      const { error } = await supabase.from("goals").insert(
        goals.map((g) => {
          const existing = existingGoalMap.get(g.goalId);
          return {
            id: g.goalId,
            lesson_id: sourceId,
            piece_id: g.pieceId,
            text: g.text,
            completed: existing?.completed ?? g.completed,
            note: existing?.note ?? null,
          };
        })
      );
      if (error) console.error("Failed to insert goals:", error.message);
    }
  }

  revalidatePath("/");
  return { success: true };
}
