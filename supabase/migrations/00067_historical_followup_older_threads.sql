-- Steer historical-followup toward older, own-authored threads.
--
-- Two failure modes prompted this:
--   1. It picked up a thread from *earlier the same day*, which reads as a recap,
--      not a "remember when you wrote about…" follow-up.
--   2. With the family feed in scope, it referenced another member's shared post
--      as if the user had written it ("You wrote about…" when a sibling did). The
--      history load is now scoped to the user's own entries (see context.ts), and
--      this wording reinforces that the thread must be one the user wrote.
--
-- base_description is locked (read-only) for built-in types, so updating it here
-- never clobbers a user edit; only custom types have an editable base_description.

UPDATE journal_question_types
SET base_description = 'Re-reads your own earlier journal entries and picks up a specific thread you wrote about a while back — not today or the past day or two — referencing it directly. Favor older threads that have had time to develop or settle; leave very recent moments to the recap and loop questions. Only draws on entries you wrote yourself, never another family member''s shared post.'
WHERE name = 'historical-followup'
  AND is_builtin = true;
