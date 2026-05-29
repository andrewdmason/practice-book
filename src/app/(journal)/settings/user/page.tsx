import { SingleFileEditor } from "@/components/journal/agent-file-editor";
import { UserDocPrompt } from "@/components/journal/user-doc-prompt";
import { createClient } from "@/lib/supabase/server";
import { loadFamilyDoc } from "@/lib/journal/context";
import { requireUserId } from "@/lib/journal/auth";
import { buildUserDocPrompt } from "@/lib/journal/seeds/user-doc-prompt";

export const dynamic = "force-dynamic";

export default async function UserSettingsPage() {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);

  const [fileRes, familyDoc, memberRes] = await Promise.all([
    supabase
      .from("journal_agent_files")
      .select("content")
      .eq("name", "User")
      .maybeSingle(),
    loadFamilyDoc(),
    supabase
      .from("journal_members")
      .select("name")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const prompt = buildUserDocPrompt({
    familyDoc,
    memberName: memberRes.data?.name ?? null,
  });

  return (
    <>
      <UserDocPrompt prompt={prompt} />
      <SingleFileEditor name="User" initialMarkdown={fileRes.data?.content ?? ""} />
    </>
  );
}
