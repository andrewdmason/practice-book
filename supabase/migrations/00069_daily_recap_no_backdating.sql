-- Stop daily-recap from back-dating a today event to satisfy its yesterday rule.
--
-- The past-only calendar block still lists today's already-happened events (for
-- recent-calendar's sake). When daily-recap had no real yesterday event but a
-- salient today one (a pickleball game this afternoon), the model grabbed it and
-- relabeled it "yesterday afternoon" to fit the category — a flat date error. A
-- companion guard in the system prompt now forbids contradicting the calendar's
-- day labels; this spells the rule out at the category level too.
--
-- base_description is locked (read-only) for built-in types, so updating it here
-- never clobbers a user edit; only custom types have an editable base_description.

UPDATE journal_question_types
SET base_description = 'Asks about a small, concrete moment from yesterday — something that already happened — leaning on your calendar rather than past entries. Never asks about today or anything still upcoming. Only draw on a calendar event that actually falls on yesterday (or earlier); if there''s nothing from yesterday, ask about yesterday in general rather than borrowing a today event and back-dating it.'
WHERE name = 'daily-recap'
  AND is_builtin = true;
