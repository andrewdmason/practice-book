/**
 * How far the calendar block reaches, chosen per question type:
 * - "recent": last 3 days including today's already-happened events (recent-calendar).
 * - "ahead": last 3 days plus the next 7 (the only forward-looking window — intentions).
 */
export type CalendarWindow = "recent" | "ahead";

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
