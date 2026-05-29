import { redirect } from "next/navigation";
import { FamilyManager } from "@/components/journal/family-manager";
import { FamilyDocEditor } from "@/components/journal/family-doc-editor";
import { getIsOwner } from "@/lib/journal/auth";
import { loadFamilyDoc } from "@/lib/journal/context";
import { listFamilyMembers } from "./actions";

export const dynamic = "force-dynamic";

export default async function FamilySettingsPage() {
  // Owner-only. Non-owners are bounced to the first settings tab.
  if (!(await getIsOwner())) {
    redirect("/settings/questions");
  }

  const [members, familyDoc] = await Promise.all([
    listFamilyMembers(),
    loadFamilyDoc(),
  ]);
  return (
    <>
      <FamilyManager members={members} />
      <FamilyDocEditor initialContent={familyDoc} />
    </>
  );
}
