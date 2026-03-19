"use client";

import { CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimeSummary } from "@/components/timer/time-summary";
import { FeedSection } from "./feed-section";
import { FeedLessonCard } from "./feed-lesson-card";
import type { FeedDay, PieceSuggestion } from "@/lib/types";

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

type FeedDayCardProps = {
  day: FeedDay;
  pieces: PieceSuggestion[];
};

export function FeedDayCard({ day, pieces }: FeedDayCardProps) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = day.date === today;

  return (
    <div className="space-y-3">
      {/* Date header */}
      <div className="flex items-center gap-2">
        <CalendarIcon className="size-4 text-muted-foreground" />
        <h3 className="font-serif text-lg font-semibold">
          {formatDateHeader(day.date)}
        </h3>
      </div>

      {/* Time summary */}
      {day.timeSummary.length > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <TimeSummary entries={day.timeSummary} label={isToday ? "Today" : "Practice Time"} />
          </CardContent>
        </Card>
      )}

      {/* Practice entry sections */}
      {day.practiceEntry && day.practiceEntry.sections.length > 0 && (
        <Card>
          <CardHeader className="pb-0 pt-3 px-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Practice Notes
            </p>
          </CardHeader>
          <CardContent className="px-1 pb-2 pt-1">
            {day.practiceEntry.sections.map((section) => (
              <FeedSection
                key={section.id}
                section={section}
                isToday={isToday}
                pieces={pieces}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lesson entries */}
      {day.lessons.map((lesson) => (
        <FeedLessonCard key={lesson.id} lesson={lesson} />
      ))}
    </div>
  );
}
