import { redirect } from "next/navigation";

// Settings defaults to the first tab.
export default function SettingsPage() {
  redirect("/settings/questions");
}
