"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedDayCard } from "./feed-day-card";
import { getFeedPage, createLesson } from "@/app/(app)/feed/actions";
import { StreakBadge } from "@/components/reports/streak-card";
import type { FeedDay, PieceSuggestion, StreakData } from "@/lib/types";

type PracticeFeedProps = {
  initialData: { items: FeedDay[]; nextCursor: string | null };
  pieces: PieceSuggestion[];
  streak?: StreakData;
};

export function PracticeFeed({ initialData, pieces, streak }: PracticeFeedProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusKey = searchParams.get("focus");
  const [feedDays, setFeedDays] = useState(initialData.items);
  const [cursor, setCursor] = useState(initialData.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await getFeedPage(cursor);
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
    startTransition(async () => {
      const lessonId = await createLesson();
      router.push(`/lessons/${lessonId}`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Practice</h2>
          {streak && <StreakBadge data={streak} />}
        </div>
        <Button
          variant="outline"
          size="sm"
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
      {feedDays.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No practice entries yet. Start the timer to begin!
        </p>
      ) : (
        feedDays.map((day) => (
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
