-- Questions the picker showed but the user didn't choose — rerolled away from,
-- or left unpicked in the final set. Fed back into the candidate generator as a
-- soft "don't repeat verbatim" signal so the same prompt doesn't resurface day
-- after day. Distinct from the in-session `rejected` list (a hard avoid): a
-- cross-day skip often just means "not today", so the topic stays fair game.

CREATE TABLE journal_skipped_questions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question   text NOT NULL,
  entry_id   uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
  skipped_on date NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_journal_skipped_questions_skipped_on
  ON journal_skipped_questions (skipped_on DESC);
