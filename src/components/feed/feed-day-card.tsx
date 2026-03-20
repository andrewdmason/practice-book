"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { BookOpenIcon, CalendarIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { deleteLesson } from "@/app/(app)/feed/actions";
import dynamic from "next/dynamic";
import { FeedSection } from "./feed-section";

const RichTextEditor = dynamic(
  () =>
    import("@/components/editor/rich-text-editor").then(
      (m) => m.RichTextEditor
    ),
  { ssr: false }
);
import { useTimer } from "@/components/timer/timer-context";
import { localDate } from "@/lib/date-utils";
import { formatMinutes } from "@/lib/timer-utils";
import { saveEditorContent } from "@/app/(app)/editor/actions";
import { AddSectionButton } from "./add-section-button";
import type { FeedDay, FeedPracticeEntry, PieceSuggestion, PracticeEntrySection, TimeSummaryEntry, TimerTarget } from "@/lib/types";

function formatDateHeader(dateStr: string): string {
  const today = localDate();
  if (dateStr === today) return "Today";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === localDate(yesterday)) return "Yesterday";

  const date = new Date(dateStr + "T12:00:00"); // noon to avoid timezone issues
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getSectionTime(
  section: { category: string; piece_id: string | null },
  timeSummary: TimeSummaryEntry[]
): number {
  if (section.category === "piece" && section.piece_id) {
    const entry = timeSummary.find((t) => t.piece_id === section.piece_id);
    return entry?.total_seconds ?? 0;
  }
  if (section.category === "technique") {
    const entry = timeSummary.find((t) => t.category === "technique");
    return entry?.total_seconds ?? 0;
  }
  if (section.category === "sight_reading") {
    const entry = timeSummary.find((t) => t.category === "sight_reading");
    return entry?.total_seconds ?? 0;
  }
  return 0;
}

type FeedDayCardProps = {
  day: FeedDay;
  pieces: PieceSuggestion[];
  focusKey?: string | null;
};

function filterAndSortSections(
  entry: FeedPracticeEntry,
  focusKey?: string | null
) {
  const allSections = entry.sections;
  const filtered = focusKey
    ? allSections.filter((section) => {
        if (focusKey === "technique") return section.category === "technique";
        if (focusKey === "sight_reading") return section.category === "sight_reading";
        return section.piece_id === focusKey;
      })
    : allSections;

  // For practice entries, strip general (it's rendered separately as DayNotes).
  // For lessons, keep general sections inline.
  const sections = entry.type === "practice"
    ? filtered.filter((s) => s.category !== "general")
    : filtered;

  // Deduplicate by category+piece_id (concurrent ensureSections calls can create duplicates)
  const seen = new Set<string>();
  const unique = sections.filter((s) => {
    const key = `${s.category}:${s.piece_id ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [...unique].sort((a, b) => {
    const order: Record<string, number> = { technique: 0, sight_reading: 1, piece: 2, general: 3 };
    return (order[a.category] ?? 2) - (order[b.category] ?? 2);
  });
}

function sectionMatchesTarget(
  section: { category: string; piece_id: string | null },
  target: TimerTarget | null
): boolean {
  if (!target) return false;
  if (target.category === "piece") {
    return section.category === "piece" && section.piece_id === target.pieceId;
  }
  return section.category === target.category;
}

function hasContent(content: unknown): boolean {
  if (!content) return false;
  const doc = content as { content?: { type: string }[] };
  if (!doc.content || doc.content.length === 0) return false;
  if (
    doc.content.length === 1 &&
    doc.content[0].type === "paragraph" &&
    !("content" in doc.content[0])
  ) {
    return false;
  }
  return true;
}

function DayNotes({
  section,
  pieces,
}: {
  section: PracticeEntrySection;
  pieces: PieceSuggestion[];
}) {
  const sectionHasContent = hasContent(section.content);
  const [isEditing, setIsEditing] = useState(sectionHasContent);

  const handleSave = useCallback(
    async (content: JSONContent) => {
      await saveEditorContent("practice_entry", section.id, content);
    },
    [section.id]
  );

  if (isEditing) {
    return (
      <div className="px-4 prose-editor-compact text-sm">
        <RichTextEditor
          context="practice_entry"
          sourceType="practice_entry"
          sourceId={section.id}
          initialContent={section.content as JSONContent | null}
          pieces={pieces}
          onSave={handleSave}
          onDismiss={sectionHasContent ? undefined : () => setIsEditing(false)}
          placeholder="Notes for the day..."
          autoFocus={!sectionHasContent}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group/daynotes w-full px-4 py-1 text-left"
    >
      <span className="text-sm text-transparent group-hover/daynotes:text-muted-foreground/50 transition-colors">
        Notes for the day...
      </span>
    </button>
  );
}

function EntryCard({
  entry,
  isToday,
  pieces,
  timeSummary,
  focusKey,
}: {
  entry: FeedPracticeEntry;
  isToday: boolean;
  pieces: PieceSuggestion[];
  timeSummary: TimeSummaryEntry[];
  focusKey?: string | null;
}) {
  const { isRunning, currentTarget, entryElapsedSeconds } = useTimer();
  const initialEntryElapsedRef = useRef(entryElapsedSeconds);

  const sortedSections = filterAndSortSections(entry, focusKey);
  if (sortedSections.length === 0) return null;

  const liveDelta = isRunning
    ? Math.max(0, entryElapsedSeconds - initialEntryElapsedRef.current)
    : 0;

  return (
    <div className="px-1 py-2 text-sm">
      {sortedSections.map((section) => {
        const serverTime = section.time_override_seconds ?? getSectionTime(section, timeSummary);
        const isActiveSection = isToday && isRunning && sectionMatchesTarget(section, currentTarget);
        return (
          <FeedSection
            key={section.id}
            section={section}
            isToday={isToday}
            isActive={isActiveSection}
            pieces={pieces}
            timeSeconds={isActiveSection ? serverTime + liveDelta : serverTime}
            hasTimeOverride={section.time_override_seconds != null}
            editorContext={entry.type === "lesson" ? "lesson" : "practice_entry"}
          />
        );
      })}
    </div>
  );
}

export function FeedDayCard({ day, pieces, focusKey }: FeedDayCardProps) {
  const today = localDate();
  const isToday = day.date === today;
  const { isRunning, entryElapsedSeconds } = useTimer();
  const initialEntryElapsedRef = useRef(entryElapsedSeconds);

  // Track optimistic sections per entry (keyed by entry ID)
  const [optimisticSections, setOptimisticSections] = useState<
    Record<string, PracticeEntrySection[]>
  >({});

  const addOptimisticSection = useCallback(
    (entryId: string, section: PracticeEntrySection) => {
      setOptimisticSections((prev) => ({
        ...prev,
        [entryId]: [...(prev[entryId] ?? []), section],
      }));
    },
    []
  );

  // Merge server sections with optimistic ones
  const mergedPracticeEntry = useMemo(() => {
    if (!day.practiceEntry) return null;
    const extra = optimisticSections[day.practiceEntry.id] ?? [];
    if (extra.length === 0) return day.practiceEntry;
    // Filter out optimistic sections that now exist on the server (by category+piece_id)
    const serverKeys = new Set(
      day.practiceEntry.sections.map((s) => `${s.category}:${s.piece_id ?? ""}`)
    );
    const newSections = extra.filter(
      (s) => !serverKeys.has(`${s.category}:${s.piece_id ?? ""}`)
    );
    return {
      ...day.practiceEntry,
      sections: [...day.practiceEntry.sections, ...newSections],
    };
  }, [day.practiceEntry, optimisticSections]);

  const mergedLessons = useMemo(() => {
    return day.lessons.map((lesson) => {
      const extra = optimisticSections[lesson.id] ?? [];
      if (extra.length === 0) return lesson;
      const serverKeys = new Set(
        lesson.sections.map((s) => `${s.category}:${s.piece_id ?? ""}`)
      );
      const newSections = extra.filter(
        (s) => !serverKeys.has(`${s.category}:${s.piece_id ?? ""}`)
      );
      return { ...lesson, sections: [...lesson.sections, ...newSections] };
    });
  }, [day.lessons, optimisticSections]);

  const filteredPracticeSections = mergedPracticeEntry
    ? filterAndSortSections(mergedPracticeEntry, focusKey)
    : [];
  const hasPracticeSections =
    mergedPracticeEntry != null &&
    (filteredPracticeSections.length > 0 ||
      (!focusKey && day.timeSummary.length > 0) ||
      (!focusKey && mergedPracticeEntry.sections.some((s) => s.category === "general" && hasContent(s.content))));
  const visibleLessons = mergedLessons.filter(
    (lesson) => filterAndSortSections(lesson, focusKey).length > 0
  );

  const generalSection = mergedPracticeEntry?.sections.find(
    (s) => s.category === "general"
  ) ?? null;

  if (!hasPracticeSections && visibleLessons.length === 0) return null;

  // Compute day total from sections so manual time overrides are included.
  // For each section with an override, use it; otherwise fall back to timer data.
  const allSections = [
    ...(mergedPracticeEntry?.sections ?? []),
    ...mergedLessons.flatMap((l) => l.sections),
  ].filter((s) => s.category !== "general");
  const overriddenKeys = new Set<string>();
  let serverDayTotal = 0;
  for (const s of allSections) {
    if (s.time_override_seconds != null) {
      const key = `${s.category}:${s.piece_id ?? ""}`;
      if (!overriddenKeys.has(key)) {
        overriddenKeys.add(key);
        serverDayTotal += s.time_override_seconds;
      }
    }
  }
  // Add timer data for entries that weren't overridden
  for (const e of day.timeSummary) {
    const key = `${e.category}:${e.piece_id ?? ""}`;
    if (!overriddenKeys.has(key)) {
      serverDayTotal += e.total_seconds;
    }
  }
  const liveDelta = isToday && isRunning
    ? Math.max(0, entryElapsedSeconds - initialEntryElapsedRef.current)
    : 0;
  const dayTotal = serverDayTotal + liveDelta;

  return (
    <div className="space-y-3">
      {/* Date header — only shown when there are practice sections */}
      {hasPracticeSections && (
        <div className="group/header flex items-center gap-2">
          <CalendarIcon className="size-4 text-muted-foreground" />
          <h3 className="font-serif text-lg font-semibold">
            {formatDateHeader(day.date)}
          </h3>
          {dayTotal > 0 && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums font-medium text-muted-foreground">
              {formatMinutes(dayTotal)}
            </span>
          )}
          {mergedPracticeEntry && (
            <AddSectionButton
              entryId={mergedPracticeEntry.id}
              existingSections={mergedPracticeEntry.sections}
              pieces={pieces}
              onOptimisticAdd={(section) => addOptimisticSection(mergedPracticeEntry.id, section)}
            />
          )}
        </div>
      )}

      {/* Day-level general notes */}
      {!focusKey && generalSection && (
        <DayNotes section={generalSection} pieces={pieces} />
      )}

      {/* Practice entry sections */}
      {hasPracticeSections && mergedPracticeEntry && (
        <EntryCard
          entry={mergedPracticeEntry}
          isToday={isToday}
          pieces={pieces}
          timeSummary={day.timeSummary}
          focusKey={focusKey}
        />
      )}

      {/* Lesson entries */}
      {visibleLessons.map((lesson) => {
        return (
        <div key={lesson.id} className="space-y-3">
          <div className="group/header flex items-center gap-2">
            <BookOpenIcon className="size-4 text-muted-foreground" />
            <h3 className="font-serif text-lg font-semibold">Lesson &middot; {formatDateHeader(day.date)}</h3>
            <AddSectionButton
              entryId={lesson.id}
              existingSections={lesson.sections}
              pieces={pieces}
              onOptimisticAdd={(section) => addOptimisticSection(lesson.id, section)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 opacity-0 group-hover/header:opacity-100 transition-opacity"
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => deleteLesson(lesson.id)}
                >
                  <Trash2Icon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <EntryCard
            entry={lesson}
            isToday={isToday}
            pieces={pieces}
            timeSummary={day.timeSummary}
            focusKey={focusKey}
          />
        </div>
        );
      })}

      <hr className="border-border/60" />
    </div>
  );
}
