/**
 * How far the calendar block reaches, chosen per question type:
 * - "recent": last 3 days including today's already-happened events (recent-calendar).
 * - "recap": last 3 days excluding today entirely (daily-recap — so it can't
 *   reach a today event and back-date it).
 * - "ahead": last 3 days plus the next 7 (the only forward-looking window —
 *   upcoming-calendar and intentions).
 */
export type CalendarWindow = "recent" | "recap" | "ahead";

export type CalendarSource = {
  id: string;
  displayName: string;
  feedUrl: string;
};

export type NormalizedEvent = {
  sourceId: string;
  sourceName: string;
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  location: string | null;
  tentative: boolean;
};

export type FeedResult =
  | {
      ok: true;
      sourceId: string;
      sourceName: string;
      events: NormalizedEvent[];
    }
  | {
      ok: false;
      sourceId: string;
      sourceName: string;
      error: string;
    };
