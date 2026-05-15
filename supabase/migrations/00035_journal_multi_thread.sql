-- Allow multiple journal entries per day. The morning entry is still the
-- canonical "today's question" but the user can start additional threads
-- (a second question, a quick check-in, or just for testing) without
-- losing earlier entries.

ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_entry_date_key;

-- Help "latest entry for today" lookups stay fast.
CREATE INDEX IF NOT EXISTS idx_journal_entries_date_created
  ON journal_entries(entry_date DESC, created_at DESC);
