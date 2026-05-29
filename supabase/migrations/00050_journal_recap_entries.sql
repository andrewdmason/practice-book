-- Recap entries: a paste-in entry type for monthly chatbot recaps — a markdown
-- document (header line + bulleted topics) the user's chatbot generates. Like
-- quote entries, recaps have no AI engagement (no opening question, no
-- follow-ups, no wrap-generated title): they're closed on save with a
-- user-supplied title.
--
-- `entry_type` (migration 00048) distinguishes the kind of entry; recaps store
-- 'recap'. The recap markdown lives in the new `recap_body` column; the title
-- reuses the existing `title` column. `recap_body` is nullable — null for every
-- other entry type and for all pre-existing entries.

ALTER TABLE journal_entries
  ADD COLUMN recap_body text;
