"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedDayCard } from "./feed-day-card";
import { getFeedPage, createLesson } from "@/app/(app)/feed/actions";
import { cn } from "@/lib/utils";
import type { FeedDay, PieceSuggestion, PracticeEntryType } from "@/lib/types";

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

export function PracticeFeed({ initialData, pieces, typeFilter }: PracticeFeedProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusKey = searchParams.get("focus");
  const [feedDays, setFeedDays] = useState(initialData.items);
  const [cursor, setCursor] = useState(initialData.nextCursor);

  // Sync with server when initialData changes (e.g. after router.refresh())
  useEffect(() => {
    setFeedDays(initialData.items);
    setCursor(initialData.nextCursor);
  }, [initialData]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const setTypeFilter = (value: PracticeEntryType | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("type", value);
    } else {
      params.delete("type");
    }
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  };

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await getFeedPage(cursor, 7, typeFilter);
      setFeedDays((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, typeFilter]);

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
      {/* Type filter */}
      <div className="flex items-center gap-1.5">
        {typeFilterOptions.map((opt) => (
          <button
            key={opt.label}
            onClick={() => setTypeFilter(opt.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              typeFilter === opt.value
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
      {feedDays.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {typeFilter === "lesson"
            ? "No lessons yet. Click New Lesson to get started!"
            : typeFilter === "practice"
              ? "No practice entries yet. Start the timer to begin!"
              : "No entries yet. Start the timer or add a lesson!"}
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
