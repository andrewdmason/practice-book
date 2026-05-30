-- Family accounts, phase 1: scope every journal table to a user.
--
-- Until now the journal was single-user: no user_id anywhere, and RLS was just
-- "any authenticated user". This adds user_id to every journal table, backfills
-- existing data to the owner, enforces per-user RLS, and adds the phase-2
-- forward-compat seam (journal_entries.visibility) so the family feed needs no
-- future RLS migration.
--
-- Ordering is mandatory: add nullable columns -> backfill -> SET NOT NULL /
-- constraint reworks -> RLS. Flipping RLS or enforcing NOT NULL before the
-- backfill would either fail or hide the owner's own data mid-migration.

-- ============================================================
-- 1. Add nullable user_id to every journal table
-- ============================================================
-- Directly-scoped tables (owned in their own right):
ALTER TABLE journal_agent_files      ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE journal_calendar_sources ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE journal_entries          ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE journal_question_types   ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE journal_settings         ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
-- Child tables (denormalized copy of the parent entry's owner, mirroring the
-- storage-bucket {auth.uid()}/... convention so RLS is a simple column check):
ALTER TABLE journal_messages           ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE journal_entry_photos       ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE journal_memory_proposals   ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE journal_skipped_questions  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE journal_profile_suggestions ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Backfill
-- ============================================================
-- Pre-migration every row belongs to the single authorized user (the owner), so
-- we assign all of it to them. If the owner's auth user doesn't exist yet (a
-- fresh db reset / CI / clean prod, where earlier migrations left orphan seed
-- rows owned by nobody), we delete those orphans instead so SET NOT NULL passes;
-- provisioning recreates them from the code template on the owner's first login.
DO $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT id INTO owner_id FROM auth.users WHERE email = 'andrew@mason.io';

  IF owner_id IS NULL THEN
    RAISE NOTICE 'No owner auth user; clearing orphan journal seed rows (fresh DB).';
    DELETE FROM journal_messages            WHERE user_id IS NULL;
    DELETE FROM journal_entry_photos        WHERE user_id IS NULL;
    DELETE FROM journal_memory_proposals    WHERE user_id IS NULL;
    DELETE FROM journal_skipped_questions   WHERE user_id IS NULL;
    DELETE FROM journal_profile_suggestions WHERE user_id IS NULL;
    DELETE FROM journal_entries             WHERE user_id IS NULL;
    DELETE FROM journal_agent_files         WHERE user_id IS NULL;
    DELETE FROM journal_question_types      WHERE user_id IS NULL;
    DELETE FROM journal_calendar_sources    WHERE user_id IS NULL;
    DELETE FROM journal_settings            WHERE user_id IS NULL;
  ELSE
    UPDATE journal_agent_files       SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE journal_calendar_sources  SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE journal_entries           SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE journal_question_types    SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE journal_settings          SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE journal_messages           SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE journal_entry_photos       SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE journal_memory_proposals   SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE journal_skipped_questions  SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE journal_profile_suggestions SET user_id = owner_id WHERE user_id IS NULL;
  END IF;
END $$;

-- ============================================================
-- 3. Enforce NOT NULL (fails loudly if the backfill was skipped on a non-empty DB)
-- ============================================================
ALTER TABLE journal_agent_files       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE journal_calendar_sources  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE journal_entries           ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE journal_question_types    ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE journal_settings          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE journal_messages           ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE journal_entry_photos       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE journal_memory_proposals   ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE journal_skipped_questions  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE journal_profile_suggestions ALTER COLUMN user_id SET NOT NULL;

-- ============================================================
-- 4. Rework constraints that assumed a single user
-- ============================================================
-- Agent file names are unique per user, not globally (every member has their
-- own Interviewer + User rows).
ALTER TABLE journal_agent_files DROP CONSTRAINT journal_agent_files_name_key;
ALTER TABLE journal_agent_files ADD CONSTRAINT journal_agent_files_user_name_key UNIQUE (user_id, name);

-- Same for question type slugs — otherwise the second member's seeded built-ins
-- (recent-calendar, etc.) collide on the global unique.
ALTER TABLE journal_question_types DROP CONSTRAINT journal_question_types_name_key;
ALTER TABLE journal_question_types ADD CONSTRAINT journal_question_types_user_name_key UNIQUE (user_id, name);

-- Settings was a forced singleton (id int PK CHECK (id = 1)). Make it one row per
-- user keyed by user_id.
ALTER TABLE journal_settings DROP CONSTRAINT journal_settings_id_check;
ALTER TABLE journal_settings DROP CONSTRAINT journal_settings_pkey;
ALTER TABLE journal_settings DROP COLUMN id;
ALTER TABLE journal_settings ADD PRIMARY KEY (user_id);

-- ============================================================
-- 5. Phase-2 forward-compat seam: per-post visibility
-- ============================================================
ALTER TABLE journal_entries
  ADD COLUMN visibility text NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'family'));

-- ============================================================
-- 6. RLS: replace "any authenticated user" with per-user scoping
-- ============================================================
-- Simple own-rows policy for every table except journal_entries.
DROP POLICY "Authenticated access" ON journal_agent_files;
CREATE POLICY "Own rows" ON journal_agent_files FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY "Authenticated access" ON journal_calendar_sources;
CREATE POLICY "Own rows" ON journal_calendar_sources FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY "Authenticated access" ON journal_question_types;
CREATE POLICY "Own rows" ON journal_question_types FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY "Authenticated access" ON journal_settings;
CREATE POLICY "Own rows" ON journal_settings FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY "Authenticated access" ON journal_messages;
CREATE POLICY "Own rows" ON journal_messages FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY "Authenticated access" ON journal_entry_photos;
CREATE POLICY "Own rows" ON journal_entry_photos FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY "Authenticated access" ON journal_memory_proposals;
CREATE POLICY "Own rows" ON journal_memory_proposals FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- journal_skipped_questions was created (00046) without RLS enabled and had no
-- policy — enable it here rather than dropping a nonexistent policy.
ALTER TABLE journal_skipped_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own rows" ON journal_skipped_questions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY "Authenticated access" ON journal_profile_suggestions;
CREATE POLICY "Own rows" ON journal_profile_suggestions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- journal_entries: writes are strictly own-row, but SELECT is written in its
-- final phase-2 form now (own rows OR anything shared to the family). Since
-- visibility defaults to 'private' and no phase-1 code sets 'family', this
-- behaves as own-rows-only today — but the family feed will need zero RLS
-- migration later.
DROP POLICY "Authenticated access" ON journal_entries;
CREATE POLICY "Read own or family" ON journal_entries FOR SELECT
  USING (user_id = auth.uid() OR visibility = 'family');
CREATE POLICY "Insert own" ON journal_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own" ON journal_entries FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own" ON journal_entries FOR DELETE
  USING (user_id = auth.uid());
-- NOTE (phase 2): child tables (journal_messages, journal_entry_photos) stay
-- own-rows-only above. When the family feed needs another member's transcript or
-- photos for a family-visible entry, add an `OR EXISTS (family entry)` seam to
-- those SELECT policies then — deferred now to avoid a subquery on every read.

-- ============================================================
-- 7. Indexes: every query is now implicitly filtered by user_id
-- ============================================================
DROP INDEX IF EXISTS idx_journal_entries_date_created;
CREATE INDEX idx_journal_entries_user_date_created
  ON journal_entries (user_id, entry_date DESC, created_at DESC);
CREATE INDEX idx_journal_question_types_user_sort
  ON journal_question_types (user_id, sort_order);
CREATE INDEX idx_journal_skipped_questions_user_skipped_on
  ON journal_skipped_questions (user_id, skipped_on DESC);
