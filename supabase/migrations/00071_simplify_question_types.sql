-- Simplify the journal question-type set and add a `principles` type.
--
-- Four clusters of near-duplicate types are merged into one survivor each, and a
-- new `principles` type is added. This brings every existing user's set in line
-- with the code seed (BUILTIN_QUESTION_TYPES in seeds/defaults.ts) and the age
-- mixes (seeds/interviewer-templates.ts).
--
--   daily-recap        -> recent-calendar     (recent moments that already happened)
--   upcoming-calendar  -> intentions          (looking ahead + what you want from it)
--   unresolved-loop    -> historical-followup (follow up on your own past entries)
--   mood-check-in + sensory-moment -> gratitude (refocused: a source-grounded gratitude prompt)
--   (new)              -> principles          (a belief/value grounded in a real story)
--
-- Merge intent is preserved per user: the survivor takes the GREATEST weight and
-- the OR of the enabled flags of the types it absorbs, so a cadence the user set
-- on a now-removed type carries onto its survivor. The order matters — the
-- gratitude refocus reads mood-check-in/sensory-moment and the weight bumps read
-- daily-recap/upcoming-calendar/unresolved-loop, so the deletes come last.
--
-- base_description is locked (read-only) for built-in types, so rewriting it here
-- never clobbers a user edit; only custom types have an editable base_description.
-- User-authored style_notes on the removed types are dropped (they tuned a type
-- that no longer exists).

-- 1a. Rewrite the surviving built-ins' descriptions to their broadened text.
UPDATE journal_question_types
SET base_description = 'Asks about a specific recent moment that already happened — pulled from your connected calendar over the last few days, or just from your day, including yesterday. Best once it has already happened; don''t ask about today''s still-upcoming events or anything in the future.'
WHERE name = 'recent-calendar' AND is_builtin = true;

UPDATE journal_question_types
SET base_description = 'Re-reads your own earlier journal entries and picks up a specific thread — an older one that''s had time to develop or settle, or a more recent worry or tension you mentioned but left unresolved — and checks back on it, referencing it directly. Only draws on entries you wrote yourself, never another family member''s shared post.'
WHERE name = 'historical-followup' AND is_builtin = true;

UPDATE journal_question_types
SET base_description = 'A forward-looking prompt about what''s coming up and what you want from it — today, tomorrow, or the week ahead — with a light read on what''s on your calendar.'
WHERE name = 'intentions' AND is_builtin = true;

-- 1b. Carry each removed type's cadence onto its survivor (per user).
UPDATE journal_question_types r
SET weight = GREATEST(r.weight, m.weight),
    enabled = r.enabled OR m.enabled
FROM journal_question_types m
WHERE m.user_id = r.user_id
  AND r.name = 'recent-calendar' AND m.name = 'daily-recap';

UPDATE journal_question_types r
SET weight = GREATEST(r.weight, m.weight),
    enabled = r.enabled OR m.enabled
FROM journal_question_types m
WHERE m.user_id = r.user_id
  AND r.name = 'intentions' AND m.name = 'upcoming-calendar';

UPDATE journal_question_types r
SET weight = GREATEST(r.weight, m.weight),
    enabled = r.enabled OR m.enabled
FROM journal_question_types m
WHERE m.user_id = r.user_id
  AND r.name = 'historical-followup' AND m.name = 'unresolved-loop';

-- 2. Refocus gratitude into a source-grounded gratitude prompt, folding in the
--    cadence of the two light prompts it absorbs (mood-check-in, sensory-moment):
--    gratitude takes the greatest weight of the three and stays on if any was on.
--    Runs before the delete so those two rows' values are still present.
UPDATE journal_question_types g
SET weight = sub.w,
    enabled = sub.e,
    base_description = 'A prompt to name something you''re grateful for — anchored to something specific, not a generic ''what are you grateful for today?''. Draw on the Present doc (a person, project, or place that matters to you) or a recent entry so the gratitude centers on a real person, thing, or moment in your life.'
FROM (
  SELECT user_id, MAX(weight) AS w, bool_or(enabled) AS e
  FROM journal_question_types
  WHERE name IN ('gratitude', 'mood-check-in', 'sensory-moment')
  GROUP BY user_id
) sub
WHERE g.user_id = sub.user_id
  AND g.name = 'gratitude'
  AND g.is_builtin = true;

-- 3. Add the new principles type for every user, live at a weekly cadence so it
--    starts appearing; users can re-dial it in Settings → Questions.
INSERT INTO journal_question_types
  (user_id, name, base_description, weight, enabled, is_builtin, sort_order)
SELECT
  u.user_id,
  'principles',
  'Invites you to put a principle, belief, or value into words and ground it in a real story — something that happened that taught it to you, or shows it in action. Draw on the Past and Present docs and your earlier entries to make it specific and personal. The kind of thing worth passing down.',
  3,
  true,
  true,
  20
FROM (SELECT DISTINCT user_id FROM journal_question_types) u
ON CONFLICT (user_id, name) DO NOTHING;

-- 4. Remove the merged-away types. (gratitude survives — it was refocused above.)
DELETE FROM journal_question_types
WHERE name IN (
  'daily-recap',
  'upcoming-calendar',
  'unresolved-loop',
  'mood-check-in',
  'sensory-moment'
);
