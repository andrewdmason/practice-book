"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2Icon, MessageSquareTextIcon } from "lucide-react";
import { MentionCard } from "./mention-card";
import type { MentionPage } from "@/lib/types";

type MentionFeedProps = {
  initialData: MentionPage;
  loadMore: (cursor: string) => Promise<MentionPage>;
};

export function MentionFeed({ initialData, loadMore }: MentionFeedProps) {
  const [mentions, setMentions] = useState(initialData.items);
  const [cursor, setCursor] = useState(initialData.nextCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleLoadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const result = await loadMore(cursor);
      setMentions((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, loadMore]);

  useEffect(() => {
    if (!sentinelRef.current || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void handleLoadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [cursor, handleLoadMore]);

  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        <MessageSquareTextIcon className="size-3.5" />
        Mentions
      </h3>
      {mentions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No mentions yet.</p>
      ) : (
        <div className="space-y-2">
          {mentions.map((mention) => (
            <MentionCard key={mention.id} mention={mention} />
          ))}
        </div>
      )}
      {cursor && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loading && (
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}
