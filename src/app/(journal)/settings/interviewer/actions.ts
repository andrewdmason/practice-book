"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/journal/auth";
import { INTERVIEWER_TEMPLATES } from "@/lib/journal/seeds/interviewer-templates";

/**
 * Apply an age-based interviewer personality to the current user: sets the
 * Interviewer voice doc AND the question-type mix (which built-in types are on
 * and at what weight). Custom (user-created) question types are left untouched.
 */
export async function applyInterviewerTemplate(templateId: string): Promise<void> {
  const template = INTERVIEWER_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error("Unknown interviewer template.");

  const supabase = await createClient();
  await requireUserId(supabase);

  // Voice doc. RLS scopes the update to the caller's own row.
  const { error: fileErr } = await supabase
    .from("journal_agent_files")
    .update({ content: template.content })
    .eq("name", "Interviewer");
  if (fileErr) throw new Error(fileErr.message);

  // Question mix: set each built-in type's weight from the template (0 = off);
  // anything not in the mix is turned off. Custom types are not built-in, so
  // they're skipped entirely.
  const { data: types, error: typesErr } = await supabase
    .from("journal_question_types")
    .select("id, name, is_builtin");
  if (typesErr) throw new Error(typesErr.message);

  for (const t of types ?? []) {
    if (!t.is_builtin) continue;
    const weight = template.mix[t.name as string] ?? 0;
    const { error } = await supabase
      .from("journal_question_types")
      .update({ weight, enabled: weight > 0 })
      .eq("id", t.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/settings", "layout");
}
