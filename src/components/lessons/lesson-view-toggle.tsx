"use client";

import { useRouter } from "next/navigation";
import { LayoutListIcon, FileTextIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lessons-view-mode";

export type LessonViewMode = "single" | "list";

export function setStoredLessonViewMode(mode: LessonViewMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

export function getStoredLessonViewMode(): LessonViewMode | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "single" || v === "list") return v;
    return null;
  } catch {
    return null;
  }
}

export function LessonViewToggle({ mode }: { mode: LessonViewMode }) {
  const router = useRouter();

  const go = (target: LessonViewMode) => {
    setStoredLessonViewMode(target);
    router.push(target === "single" ? "/practice/lessons/upcoming" : "/practice/lessons/list");
  };

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border bg-background p-0.5">
      <button
        type="button"
        onClick={() => go("single")}
        className={cn(
          "inline-flex items-center justify-center size-7 rounded text-muted-foreground hover:text-foreground transition-colors",
          mode === "single" && "bg-accent text-foreground"
        )}
        title="Single lesson view"
      >
        <FileTextIcon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => go("list")}
        className={cn(
          "inline-flex items-center justify-center size-7 rounded text-muted-foreground hover:text-foreground transition-colors",
          mode === "list" && "bg-accent text-foreground"
        )}
        title="List view"
      >
        <LayoutListIcon className="size-3.5" />
      </button>
    </div>
  );
}
