"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "journal-feed";

export type JournalFeed = "all" | "me" | "family";

export function setStoredJournalFeed(feed: JournalFeed) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, feed);
  } catch {
    // ignore
  }
}

export function getStoredJournalFeed(): JournalFeed | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "all" || v === "me" || v === "family") return v;
    return null;
  } catch {
    return null;
  }
}

function hrefFor(feed: JournalFeed): string {
  return feed === "all" ? "/journal" : `/journal?feed=${feed}`;
}

const OPTIONS: { feed: JournalFeed; label: string }[] = [
  { feed: "all", label: "All" },
  { feed: "me", label: "Me" },
  { feed: "family", label: "Family" },
];

export function JournalFeedToggle({ feed }: { feed: JournalFeed }) {
  const router = useRouter();

  // Remember the last-selected feed across visits. The default feed ("all")
  // is what the page renders when there's no `feed` param, so only then do we
  // honor a stored preference and redirect to it. When a param is present, the
  // URL wins and we sync localStorage to match.
  useEffect(() => {
    if (feed === "all") {
      const stored = getStoredJournalFeed();
      if (stored && stored !== "all") {
        setStoredJournalFeed(stored);
        router.replace(hrefFor(stored));
        return;
      }
    }
    setStoredJournalFeed(feed);
  }, [feed, router]);

  const go = (target: JournalFeed) => {
    setStoredJournalFeed(target);
    router.push(hrefFor(target));
  };

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border bg-background p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.feed}
          type="button"
          onClick={() => go(option.feed)}
          className={cn(
            "inline-flex items-center justify-center rounded px-3 py-1 font-serif text-sm text-muted-foreground transition-colors hover:text-foreground",
            feed === option.feed && "bg-accent text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
