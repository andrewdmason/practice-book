-- Four playful/concrete question types that work well for kids (and are nice
-- for anyone in moderation). New users get them via the code seed; this adds
-- them to every existing user's set, disabled by default. The age-based
-- interviewer templates turn them on with an age-appropriate mix.

INSERT INTO journal_question_types
  (user_id, name, base_description, weight, enabled, is_builtin, sort_order)
SELECT u.user_id, v.name, v.base_description, 0, false, true, v.sort_order
FROM (SELECT DISTINCT user_id FROM journal_question_types) u
CROSS JOIN (VALUES
  ('favorites',    'Asks you to name a favorite from today — a food, a song, a moment, something you played or watched. Light and concrete.', 14),
  ('imagination',  'A playful what-if or would-you-rather — pure imagination, not tied to your real day.', 15),
  ('proud-moment', 'Asks about something you figured out, pulled off, or feel proud of.', 16),
  ('funny-moment', 'Asks about something that made you laugh recently.', 17)
) AS v(name, base_description, sort_order)
ON CONFLICT (user_id, name) DO NOTHING;
