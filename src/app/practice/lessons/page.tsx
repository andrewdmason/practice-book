"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredLessonViewMode } from "@/components/lessons/lesson-view-toggle";

export default function LessonsPage() {
  const router = useRouter();

  useEffect(() => {
    const mode = getStoredLessonViewMode();
    router.replace(mode === "list" ? "/practice/lessons/list" : "/practice/lessons/upcoming");
  }, [router]);

  return null;
}
