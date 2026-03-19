-- Add optional time override to practice entry sections.
-- When set, this value is used instead of the timer-derived time.
ALTER TABLE practice_entry_sections
  ADD COLUMN time_override_seconds integer;
