import type { CalendarSource, FeedResult } from "./types";
import { fetchAndParseFeed } from "./fetch";

const TTL_MS = 30 * 60 * 1000;

type CachedFeed = {
  result: FeedResult;
  fetchedAt: number;
};

const cache = new Map<string, CachedFeed>();
const inflight = new Map<string, Promise<FeedResult>>();

export function loadFeedCached(
  source: CalendarSource,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<FeedResult> {
  const cached = cache.get(source.feedUrl);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return Promise.resolve(cached.result);
  }
  const existing = inflight.get(source.feedUrl);
  if (existing) return existing;

  const p = fetchAndParseFeed(source, rangeStart, rangeEnd)
    .then((result) => {
      // Only cache successful fetches so a failure doesn't sit for 30 minutes.
      if (result.ok) {
        cache.set(source.feedUrl, { result, fetchedAt: Date.now() });
      }
      return result;
    })
    .finally(() => {
      inflight.delete(source.feedUrl);
    });

  inflight.set(source.feedUrl, p);
  return p;
}

export function clearCalendarCache(): void {
  cache.clear();
  inflight.clear();
}
