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
