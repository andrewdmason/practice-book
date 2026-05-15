-- The journal day now starts with a three-question picker instead of a single
-- streamed opening question. opening_candidates holds the three proposed
-- questions until the user picks one (then it's cleared back to null).
-- candidates_reroll_count persists the picker reroll cap across page reloads.

ALTER TABLE journal_entries ADD COLUMN opening_candidates jsonb;
ALTER TABLE journal_entries ADD COLUMN candidates_reroll_count integer NOT NULL DEFAULT 0;
