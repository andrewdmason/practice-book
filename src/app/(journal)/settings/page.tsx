import { redirect } from "next/navigation";

// Settings defaults to the first (leftmost) tab.
export default function SettingsPage() {
  redirect("/settings/user");
}
