-- Keep the relationship question type centered on a person, not a calendar event.
--
-- The calendar block is in the system prompt for every question type, so a
-- salient event (a piano recital this morning) could get pulled into the
-- relationship slot and reframed as "how did the recital go" — a solo-event
-- question wearing a relationship label. Spell out that the question must be
-- about a specific person and the user's connection with them, mirroring the
-- no-future-events guards added to daily-recap / me-topic in 00060.
--
-- base_description is locked (read-only) for built-in types, so updating it here
-- never clobbers a user edit; only custom types have an editable base_description.

UPDATE journal_question_types
SET base_description = 'Surfaces a specific person from your Present doc or recent entries and asks about a recent moment with them. The question has to center on that person and your connection — never reframe a solo activity or calendar event (a recital, a workout, an errand) as a relationship question. If no specific person fits, ask about someone in your life rather than reaching for something on your calendar.'
WHERE name = 'relationship'
  AND is_builtin = true;
