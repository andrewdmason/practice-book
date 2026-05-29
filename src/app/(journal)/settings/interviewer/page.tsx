import { SingleFileEditor } from "@/components/journal/agent-file-editor";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InterviewerSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_agent_files")
    .select("content")
    .eq("name", "Interviewer")
    .maybeSingle();

  return (
    <SingleFileEditor
      target={{ kind: "agent", name: "Interviewer" }}
      initialMarkdown={data?.content ?? ""}
    />
  );
}
