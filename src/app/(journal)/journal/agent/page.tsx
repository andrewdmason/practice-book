import { AgentFileEditor } from "@/components/journal/agent-file-editor";
import { createClient } from "@/lib/supabase/server";
import type { JournalAgentFile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const supabase = await createClient();
  const { data: filesRes } = await supabase
    .from("journal_agent_files")
    .select("id, name, content, agent_writable, created_at, updated_at")
    .order("name");

  const files = (filesRes ?? []) as JournalAgentFile[];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-24 pt-12">
      <AgentFileEditor files={files} />
    </div>
  );
}
