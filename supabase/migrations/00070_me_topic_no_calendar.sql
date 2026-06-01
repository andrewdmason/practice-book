-- Keep me-topic out of the calendar entirely, not just future events.
--
-- 00060 told me-topic to avoid *upcoming* calendar events, but left it free to
-- pull a *past* one — so it asked "how did the piano recital go" off a calendar
-- entry instead of drawing on the Present doc. The candidate generator now also
-- omits the calendar block from rounds with no calendar-consuming category, but
-- when me-topic shares a round with a calendar type the block is still present,
-- so the category guard has to stand on its own.
--
-- base_description is locked (read-only) for built-in types, so updating it here
-- never clobbers a user edit; only custom types have an editable base_description.

UPDATE journal_question_types
SET base_description = 'Draws on your Present doc — projects, interests, people — and asks about one, rotating so it doesn''t fixate on the same thing. Stays in the Present doc: never pulls from your calendar at all, neither upcoming events nor past ones (a recital, a game, an appointment) — the calendar question types own those. If the Present doc is thin, ask a broader question about a known project or interest rather than reaching for a calendar event.'
WHERE name = 'me-topic'
  AND is_builtin = true;
