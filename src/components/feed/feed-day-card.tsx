"use client";

import { CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FeedSection } from "./feed-section";
import { FeedLessonCard } from "./feed-lesson-card";
import type { FeedDay, PieceSuggestion, TimeSummaryEntry } from "@/lib/types";

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

export function FeedDayCard({ day, pieces, focusKey }: FeedDayCardProps) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = day.date === today;

  // Filter sections based on focusKey
  const allSections = day.practiceEntry?.sections ?? [];
  const filteredSections = focusKey
    ? allSections.filter((section) => {
        if (focusKey === "technique") return section.category === "technique";
        if (focusKey === "sight_reading") return section.category === "sight_reading";
        // focusKey is a piece ID
        return section.piece_id === focusKey;
      })
    : allSections;

  const sortedSections = [...filteredSections].sort((a, b) => {
    const order = { technique: 0, sight_reading: 1, piece: 2, general: 3 };
    return (order[a.category] ?? 2) - (order[b.category] ?? 2);
  });

  const hasNotes = sortedSections.length > 0;
  const hasLessons = !focusKey && day.lessons.length > 0;

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
      {hasNotes && (
        <Card>
          <CardHeader className="pb-0 pt-3 px-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Practice Notes
            </p>
          </CardHeader>
          <CardContent className="px-1 pb-2 pt-1">
            {sortedSections.map((section) => (
              <FeedSection
                key={section.id}
                section={section}
                isToday={isToday}
                pieces={pieces}
                timeSeconds={getSectionTime(section, day.timeSummary)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lesson entries (only show when not filtering) */}
      {hasLessons &&
        day.lessons.map((lesson) => (
          <FeedLessonCard key={lesson.id} lesson={lesson} />
        ))}
    </div>
  );
}
