"use client";

import { BookOpenIcon, CalendarIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FeedSection } from "./feed-section";
import type { FeedDay, FeedPracticeEntry, PieceSuggestion, TimeSummaryEntry } from "@/lib/types";

function formatDateHeader(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (dateStr === today) return "Today";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === yesterday.toISOString().slice(0, 10)) return "Yesterday";

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

  return [...filtered].sort((a, b) => {
    const order = { technique: 0, sight_reading: 1, piece: 2, general: 3 };
    return (order[a.category] ?? 2) - (order[b.category] ?? 2);
  });
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
  const sortedSections = filterAndSortSections(entry, focusKey);
  if (sortedSections.length === 0) return null;

  return (
    <Card>
      <CardContent className="px-1 py-2">
        {sortedSections.map((section) => (
          <FeedSection
            key={section.id}
            section={section}
            isToday={isToday}
            pieces={pieces}
            timeSeconds={getSectionTime(section, timeSummary)}
            editorContext={entry.type === "lesson" ? "lesson" : "practice_entry"}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function FeedDayCard({ day, pieces, focusKey }: FeedDayCardProps) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = day.date === today;

  const hasPracticeSections =
    day.practiceEntry != null &&
    filterAndSortSections(day.practiceEntry, focusKey).length > 0;
  const visibleLessons = day.lessons.filter(
    (lesson) => filterAndSortSections(lesson, focusKey).length > 0
  );

  if (!hasPracticeSections && visibleLessons.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Date header */}
      <div className="flex items-center gap-2">
        <CalendarIcon className="size-4 text-muted-foreground" />
        <h3 className="font-serif text-lg font-semibold">
          {formatDateHeader(day.date)}
        </h3>
      </div>

      {/* Practice entry sections */}
      {hasPracticeSections && day.practiceEntry && (
        <EntryCard
          entry={day.practiceEntry}
          isToday={isToday}
          pieces={pieces}
          timeSummary={day.timeSummary}
          focusKey={focusKey}
        />
      )}

      {/* Lesson entries */}
      {visibleLessons.map((lesson) => (
        <div key={lesson.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpenIcon className="size-4 text-muted-foreground" />
            <h3 className="font-serif text-lg font-semibold">Lesson</h3>
          </div>
          <EntryCard
            entry={lesson}
            isToday={isToday}
            pieces={pieces}
            timeSummary={day.timeSummary}
            focusKey={focusKey}
          />
        </div>
      ))}
    </div>
  );
}
