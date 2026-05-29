import { SingleFileEditor } from "@/components/journal/agent-file-editor";
import { UserDocPrompt } from "@/components/journal/user-doc-prompt";
import { InterviewerAgeSelector } from "@/components/journal/interviewer-age-selector";
import { createClient } from "@/lib/supabase/server";
import { loadFamilyDoc } from "@/lib/journal/context";
import { requireUserId } from "@/lib/journal/auth";
import { buildUserDocPrompt } from "@/lib/journal/seeds/user-doc-prompt";
import { matchTemplateId } from "@/lib/journal/seeds/interviewer-templates";

export const dynamic = "force-dynamic";

export default async function UserSettingsPage() {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);

  const [userFileRes, interviewerRes, familyDoc, memberRes] = await Promise.all([
    supabase
      .from("journal_agent_files")
      .select("content")
      .eq("name", "User")
      .maybeSingle(),
    supabase
      .from("journal_agent_files")
      .select("content")
      .eq("name", "Interviewer")
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
    ageId: matchTemplateId(interviewerRes.data?.content ?? ""),
  });

  return (
    <>
      <InterviewerAgeSelector
        interviewerContent={interviewerRes.data?.content ?? ""}
      />
      <UserDocPrompt prompt={prompt} />
      <SingleFileEditor
        target={{ kind: "agent", name: "User" }}
        initialMarkdown={userFileRes.data?.content ?? ""}
      />
    </>
  );
}
