-- Keep future calendar events out of every question type except upcoming-events.
--
-- daily-recap used to lean on "today or yesterday" and the time of day, which
-- let it ask about events still upcoming today; narrow it to yesterday only.
-- me-topic draws on the Present doc but had no guardrail against the calendar
-- block in the system prompt, so it was surfacing upcoming events too.
--
-- base_description is locked (read-only) for built-in types, so updating it here
-- never clobbers a user edit; only custom types have an editable base_description.

UPDATE journal_question_types
SET base_description = 'Asks about a small, concrete moment from yesterday — something that already happened — leaning on your calendar rather than past entries. Never asks about today or anything still upcoming.'
WHERE name = 'daily-recap'
  AND is_builtin = true;

UPDATE journal_question_types
SET base_description = 'Draws on your Present doc — projects, interests, people — and asks about one, rotating so it doesn''t fixate on the same thing. Never asks about upcoming calendar events or anything still to come — that''s the upcoming-events question type''s job.'
WHERE name = 'me-topic'
  AND is_builtin = true;
