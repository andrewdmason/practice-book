-- Quote entries: a frictionless entry type that captures a quote with no AI
-- engagement (no opening question, no follow-ups, no wrap-generated title).
--
-- `entry_type` distinguishes the kind of entry. 'standard' is the existing
-- reflective entry (picked question or freeform); 'quote' is the new type.
-- The quote text reuses the existing `pull_quote` column (already a verbatim
-- quote, already rendered in the history list); `quote_attribution` holds the
-- optional "— who / context" line. Both nullable for quotes that have no
-- attribution and for all pre-existing entries.
--
-- Not to be confused with `journal_question_types` (migration 00047), which
-- are categories for opening questions — a separate concept.

ALTER TABLE journal_entries
  ADD COLUMN entry_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN quote_attribution text;
