import { QuestionsEditor } from "@/components/journal/questions-editor";
import { createClient } from "@/lib/supabase/server";
import type { JournalQuestionType, JournalSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function QuestionsSettingsPage() {
  const supabase = await createClient();
  const [typesRes, settingsRes] = await Promise.all([
    supabase
      .from("journal_question_types")
      .select(
        "id, name, base_description, style_note, weight, enabled, is_builtin, sort_order, created_at, updated_at"
      )
      .order("sort_order", { ascending: true }),
    // One settings row per user — RLS scopes to the caller's row.
    supabase.from("journal_settings").select("questions_per_day").maybeSingle(),
  ]);

  const questionTypes = (typesRes.data ?? []) as JournalQuestionType[];
  const settings: JournalSettings = {
    questions_per_day: settingsRes.data?.questions_per_day ?? 3,
  };

  return <QuestionsEditor questionTypes={questionTypes} settings={settings} />;
}
