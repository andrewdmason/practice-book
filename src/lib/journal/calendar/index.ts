import { loadFeedCached } from "./cache";
import { formatCalendarBlock } from "./format";
import { loadCalendarSources } from "./sources";
import type { CalendarWindow, FeedResult } from "./types";

export { clearCalendarCache } from "./cache";

const DAY_MS = 86400000;

/**
 * Build the calendar context block for the interviewer's system prompt.
 * Returns null when there's nothing to inject (no sources, all failed and
 * empty, etc.) — caller treats that as "skip the block."
 *
 * `window` defaults to "recent": the block carries only past + already-happened
 * events, so a prompt can't surface something upcoming. Pass "ahead" only when
 * generating a forward-looking question (intentions).
 */
export async function loadCalendarBlock(
  today: string,
  tz: string,
  window: CalendarWindow = "recent",
): Promise<string | null> {
  let sources;
  try {
    sources = await loadCalendarSources();
  } catch (err) {
    console.error("[journal/calendar] failed to load sources:", err);
    return null;
  }
  if (sources.length === 0) return null;

  // Build an instant range a bit wider than the 10-day local window so events
  // near the TZ boundary aren't dropped by ical-expander's UTC comparison.
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const rangeStart = new Date(todayMs - (3 + 1) * DAY_MS);
  const rangeEnd = new Date(todayMs + (7 + 2) * DAY_MS);

  const settled = await Promise.allSettled(
    sources.map((s) => loadFeedCached(s, rangeStart, rangeEnd)),
  );

  const results: FeedResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    return {
      ok: false,
      sourceId: sources[i].id,
      sourceName: sources[i].displayName,
      error: s.reason instanceof Error ? s.reason.message : String(s.reason),
    };
  });

  for (const r of results) {
    if (!r.ok) {
      console.error(
        `[journal/calendar] feed "${r.sourceName}" failed: ${r.error}`,
      );
    }
  }

  const block = formatCalendarBlock(results, today, tz, new Date(), window);
  return block === "" ? null : block;
}
