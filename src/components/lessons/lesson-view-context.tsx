"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LessonIndexEntry, LessonWithEntries } from "@/lib/types";

type LessonViewContextValue = {
  lesson: LessonWithEntries;
  neighbors: { prevId: string | null; nextId: string | null };
  index: LessonIndexEntry[];
  lessonNumber: number;
  activeSectionId: string | null;
  setActiveSectionId: (id: string | null) => void;
};

const LessonViewContext = createContext<LessonViewContextValue | null>(null);

export function useLessonView() {
  const ctx = useContext(LessonViewContext);
  if (!ctx) throw new Error("useLessonView must be used within LessonViewProvider");
  return ctx;
}

export function LessonViewProvider({
  lesson,
  neighbors,
  index,
  children,
}: {
  lesson: LessonWithEntries;
  neighbors: { prevId: string | null; nextId: string | null };
  index: LessonIndexEntry[];
  children: ReactNode;
}) {
  const [activeSectionId, setActiveSectionIdState] = useState<string | null>(null);

  const setActiveSectionId = useCallback((id: string | null) => {
    setActiveSectionIdState(id);
  }, []);

  const lessonNumber = useMemo(() => {
    const idx = index.findIndex((l) => l.id === lesson.id);
    return idx >= 0 ? idx + 1 : index.length + 1;
  }, [index, lesson.id]);

  const value: LessonViewContextValue = {
    lesson,
    neighbors,
    index,
    lessonNumber,
    activeSectionId,
    setActiveSectionId,
  };

  return (
    <LessonViewContext.Provider value={value}>
      {children}
    </LessonViewContext.Provider>
  );
}
