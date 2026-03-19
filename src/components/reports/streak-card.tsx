"use client";

import { FlameIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { StreakData } from "@/lib/types";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

type StreakCardProps = {
  data: StreakData;
};

export function StreakCard({ data }: StreakCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-6 py-4">
        {/* Streak counter */}
        <div className="flex items-center gap-2">
          <FlameIcon
            className={`size-5 ${data.currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"}`}
          />
          <div>
            <p className="text-2xl font-semibold tracking-tight leading-none">
              {data.currentStreak}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              day{data.currentStreak !== 1 ? "s" : ""} streak
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-10 w-px bg-border" />

        {/* Week dots */}
        <div className="flex items-center gap-1.5">
          {data.thisWeekDays.map((practiced, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`size-3 rounded-full ${
                  practiced
                    ? "bg-orange-500"
                    : "bg-muted"
                }`}
              />
              <span className="text-[10px] text-muted-foreground leading-none">
                {DAY_LABELS[i]}
              </span>
            </div>
          ))}
        </div>

        {/* Days this week */}
        <p className="text-xs text-muted-foreground ml-auto">
          {data.daysPracticedThisWeek}/7 this week
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Compact streak badge for the practice feed header.
 */
type StreakBadgeProps = {
  data: StreakData;
};

export function StreakBadge({ data }: StreakBadgeProps) {
  if (data.currentStreak === 0 && data.daysPracticedThisWeek === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      {/* Streak */}
      {data.currentStreak > 0 && (
        <div className="flex items-center gap-1">
          <FlameIcon className="size-3.5 text-orange-500" />
          <span className="text-xs font-medium">{data.currentStreak}</span>
        </div>
      )}

      {/* Week dots */}
      <div className="flex items-center gap-1">
        {data.thisWeekDays.map((practiced, i) => (
          <div
            key={i}
            className={`size-1.5 rounded-full ${
              practiced ? "bg-orange-500" : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
