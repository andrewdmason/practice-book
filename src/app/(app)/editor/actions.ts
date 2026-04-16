"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { JSONContent } from "@tiptap/core";

export async function saveEditorContent(
  sourceId: string,
  content: JSONContent
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("practice_entry_sections")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", sourceId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}
