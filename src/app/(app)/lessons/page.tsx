import { redirect } from "next/navigation";

export default function LessonsPage() {
  redirect("/?type=lesson");
}
