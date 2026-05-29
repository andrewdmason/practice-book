-- Split the per-user "User" agent file into two docs and add a reminiscence
-- question type.
--
--   • "Present" — the renamed User doc: who the user is now, who's around them,
--     what they're working on. (Content carries over unchanged.)
--   • "Past"    — a new, initially empty biography doc: their life story.
--
-- Also adds the built-in "reminiscence" question type (which invites the user to
-- tell stories from their past) and lets profile suggestions target either doc.
--
-- All DDL/DML is kept in one migration so the rename, the new doc, the new
-- question type, and the suggestion column land atomically.

-- ============================================================
-- 1. Rename the existing User doc -> Present (keeps each user's content)
-- ============================================================
UPDATE journal_agent_files
  SET name = 'Present', updated_at = now()
  WHERE name = 'User';

-- ============================================================
-- 2. Give every user who has a Present doc a new, empty Past doc
-- ============================================================
-- agent_writable mirrors the Present doc (false): the wrap pass proposes changes
-- through suggestions rather than writing the file directly. ON CONFLICT guards
-- against re-runs and against a user who somehow already has a Past row.
INSERT INTO journal_agent_files (user_id, name, content, agent_writable)
SELECT user_id, 'Past', '', agent_writable
FROM journal_agent_files
WHERE name = 'Present'
ON CONFLICT (user_id, name) DO NOTHING;

-- ============================================================
-- 3. Built-in "reminiscence" question type for every existing user
-- ============================================================
-- Medium cadence (weight 3, enabled), mirroring how the kid types were seeded in
-- 00055. sort_order 18 follows the 17 existing built-ins.
INSERT INTO journal_question_types
  (user_id, name, base_description, style_note, weight, enabled, is_builtin, sort_order)
SELECT DISTINCT user_id,
  'reminiscence',
  'Invites the user to tell a story from their past or reminisce on something old — a memory, a place, a person, a turning point. Draw on the Past doc to make it specific.',
  '',
  3, true, true, 18
FROM journal_question_types
ON CONFLICT (user_id, name) DO NOTHING;

-- ============================================================
-- 4. Repoint the two built-ins that named the "User file" at the renamed Present doc
-- ============================================================
-- So the model connects them to the "=== Present ===" prompt section. Guarded on
-- the exact prior text so a user's hand-tuned style_note/base is never clobbered.
UPDATE journal_question_types
  SET base_description = 'Draws on your Present doc — projects, interests, people — and asks about one, rotating so it doesn''t fixate on the same thing.'
  WHERE is_builtin AND name = 'me-topic'
    AND base_description = 'Draws on your User file — projects, interests, people — and asks about one, rotating so it doesn''t fixate on the same thing.';
UPDATE journal_question_types
  SET base_description = 'Surfaces a specific person from your Present doc or recent entries and asks about a recent moment with them.'
  WHERE is_builtin AND name = 'relationship'
    AND base_description = 'Surfaces a specific person from your User file or recent entries and asks about a recent moment with them.';

-- ============================================================
-- 5. Profile suggestions can now target either the Present or the Past doc
-- ============================================================
ALTER TABLE journal_profile_suggestions
  ADD COLUMN target_doc text NOT NULL DEFAULT 'Present'
  CHECK (target_doc IN ('Present', 'Past'));
