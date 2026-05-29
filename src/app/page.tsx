import { redirect } from "next/navigation";

// The app's home is the journal (the whole family uses it). The practice book
// lives at /practice and is gated to the owner in middleware.
export default function RootPage() {
  redirect("/journal");
}
