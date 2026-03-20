"use client";

import { useState, useRef, useEffect, useCallback, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedDayCard } from "./feed-day-card";
import { getFeedPage, createLesson } from "@/app/(app)/feed/actions";
import { useTimer } from "@/components/timer/timer-context";
import { cn } from "@/lib/utils";
import { localDate } from "@/lib/date-utils";
import type { FeedDay, FeedPracticeEntry, PieceSuggestion, PracticeEntryType, TimerTarget } from "@/lib/types";

type PracticeFeedProps = {
  initialData: { items: FeedDay[]; nextCursor: string | null };
  pieces: PieceSuggestion[];
  typeFilter?: PracticeEntryType;
};

const typeFilterOptions = [
  { value: undefined, label: "All" },
  { value: "practice" as const, label: "Practice" },
  { value: "lesson" as const, label: "Lessons" },
];

function focusKeyFromTarget(target: TimerTarget | null): string | null {
  if (!target) return null;
  return target.category === "piece" ? target.pieceId : target.category;
}

export function PracticeFeed({ initialData, pieces, typeFilter }: PracticeFeedProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isRunning, currentTarget, focusedTarget } = useTimer();

  // Derive focusKey from timer context (instant) instead of URL params (slow)
  const focusKey = focusKeyFromTarget(isRunning ? currentTarget : focusedTarget);

  const [feedDays, setFeedDays] = useState(initialData.items);
  const [cursor, setCursor] = useState(initialData.nextCursor);
  // Optimistic type filter for instant pill highlighting
  const [optimisticTypeFilter, setOptimisticTypeFilter] = useState(typeFilter);

  // Sync with server when initialData changes (e.g. after router.refresh())
  useEffect(() => {
    setFeedDays(initialData.items);
    setCursor(initialData.nextCursor);
    setOptimisticTypeFilter(typeFilter);
  }, [initialData, typeFilter]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const setTypeFilter = (value: PracticeEntryType | undefined) => {
    // Instant: update state and URL without server round-trip
    setOptimisticTypeFilter(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("type", value);
    } else {
      params.delete("type");
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
  };

  // Client-side filtering — instant, no server round-trip
  const filteredDays = useMemo(() => {
    if (!optimisticTypeFilter) return feedDays;
    return feedDays
      .map((day) => ({
        ...day,
        practiceEntry: optimisticTypeFilter === "practice" ? day.practiceEntry : null,
        lessons: optimisticTypeFilter === "lesson" ? day.lessons : [],
      }))
      .filter((day) => day.practiceEntry || day.lessons.length > 0);
  }, [feedDays, optimisticTypeFilter]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await getFeedPage(cursor, 7);
      setFeedDays((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  const handleNewLesson = () => {
    const today = localDate();
    const optimisticLesson: FeedPracticeEntry = {
      id: `optimistic-${Date.now()}`,
      date: today,
      type: "lesson",
      sections: [],
    };

    // Immediately insert the lesson into the feed
    setFeedDays((prev) => {
      const idx = prev.findIndex((d) => d.date === today);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          lessons: [optimisticLesson, ...updated[idx].lessons],
        };
        return updated;
      }
      // No day for today yet — prepend one
      return [
        { date: today, practiceEntry: null, lessons: [optimisticLesson], timeSummary: [] },
        ...prev,
      ];
    });

    // Create on server, then reconcile with real data
    startTransition(async () => {
      await createLesson();
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Type filter */}
      <div className="flex items-center gap-1.5">
        {typeFilterOptions.map((opt) => (
          <button
            key={opt.label}
            onClick={() => setTypeFilter(opt.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              optimisticTypeFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={handleNewLesson}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <PlusIcon className="size-4" />
          )}
          New Lesson
        </Button>
      </div>

      {/* Feed days */}
      {filteredDays.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {optimisticTypeFilter === "lesson"
            ? "No lessons yet. Click New Lesson to get started!"
            : optimisticTypeFilter === "practice"
              ? "No practice entries yet. Start the timer to begin!"
              : "No entries yet. Start the timer or add a lesson!"}
        </p>
      ) : (
        filteredDays.map((day) => (
          <FeedDayCard key={day.date} day={day} pieces={pieces} focusKey={focusKey} />
        ))
      )}

      {/* Infinite scroll sentinel */}
      {cursor && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore && (
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}
