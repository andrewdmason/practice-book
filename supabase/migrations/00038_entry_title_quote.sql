-- Add title and pull_quote columns to journal entries. Both are produced by
-- the wrap pass alongside the summary, and become the primary surface in
-- the history list (replacing the dry "Thread N" + opening-question
-- display). Both are nullable — for thin entries the AI may skip them, and
-- old entries from before this migration won't have them.

ALTER TABLE journal_entries ADD COLUMN title text;
ALTER TABLE journal_entries ADD COLUMN pull_quote text;
