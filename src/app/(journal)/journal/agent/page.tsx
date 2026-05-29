import { AgentSettingsTabs } from "@/components/journal/agent-settings-tabs";
import { createClient } from "@/lib/supabase/server";
import type {
  JournalAgentFile,
  JournalQuestionType,
  JournalSettings,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const supabase = await createClient();
  const [filesRes, typesRes, settingsRes] = await Promise.all([
    supabase
      .from("journal_agent_files")
      .select("id, name, content, agent_writable, created_at, updated_at")
      .order("name"),
    supabase
      .from("journal_question_types")
      .select(
        "id, name, base_description, style_note, weight, enabled, is_builtin, sort_order, created_at, updated_at"
      )
      .order("sort_order", { ascending: true }),
    supabase.from("journal_settings").select("questions_per_day").eq("id", 1).maybeSingle(),
  ]);

  const files = (filesRes.data ?? []) as JournalAgentFile[];
  const questionTypes = (typesRes.data ?? []) as JournalQuestionType[];
  const settings: JournalSettings = {
    questions_per_day: settingsRes.data?.questions_per_day ?? 3,
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-24 pt-12">
      <AgentSettingsTabs files={files} questionTypes={questionTypes} settings={settings} />
    </div>
  );
}
