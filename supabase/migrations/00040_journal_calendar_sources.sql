-- Journal calendar sources: iCal feed URLs fed into the interviewer's
-- per-turn system prompt as a "what's happening in Andrew's life this week"
-- context block. See docs/journal-calendar-integration.md and
-- src/lib/journal/calendar/ for the consumer side.

CREATE TABLE journal_calendar_sources (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name text NOT NULL,
  feed_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_journal_calendar_sources_enabled
  ON journal_calendar_sources (enabled, sort_order);

CREATE TRIGGER journal_calendar_sources_updated_at
  BEFORE UPDATE ON journal_calendar_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE journal_calendar_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON journal_calendar_sources FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

INSERT INTO journal_calendar_sources (display_name, feed_url, sort_order) VALUES
  ('Personal',
   'https://calendar.google.com/calendar/ical/andrew%40mason.io/private-5b46badb9ec8a99c13b1a553fef3bca7/basic.ics',
   0),
  ('Kids — Going',
   'https://www.kidcalendar.app/api/feeds/f7ea33cd2539118cb68ba4c6cba0a00b063b465e93f12a970f362177049a025b/calendar.ics',
   1),
  ('Kids — Following',
   'https://www.kidcalendar.app/api/feeds/8ff75915669a9771a0bda36041034b120ac08e7b065c261c17be618215d4794c/calendar.ics',
   2);
