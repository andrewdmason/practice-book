"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractAssignments } from "@/components/editor/lib/extract-assignments";
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

  // 2. Extract and sync assignments (preserve progress/completion state from DB)
  const assignments = extractAssignments(content);

  // Look up the section's piece_id as fallback for assignment piece association
  let sectionPieceId: string | null = null;
  {
    const { data: section } = await supabase
      .from("practice_entry_sections")
      .select("piece_id")
      .eq("id", sourceId)
      .single();
    sectionPieceId = section?.piece_id ?? null;
  }

  const { data: existingAssignments } = await supabase
    .from("assignments")
    .select("id, progress, completed_at, note")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);

  const existingAssignmentMap = new Map(
    existingAssignments?.map((t) => [t.id, t]) ?? []
  );

  await supabase
    .from("assignments")
    .delete()
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);

  if (assignments.length > 0) {
    const now = new Date().toISOString();
    const { error } = await supabase.from("assignments").insert(
      assignments.map((t) => {
        const existing = existingAssignmentMap.get(t.taskId);
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
    if (error) console.error("Failed to insert assignments:", error.message);
  }

  revalidatePath("/");
  return { success: true };
}
