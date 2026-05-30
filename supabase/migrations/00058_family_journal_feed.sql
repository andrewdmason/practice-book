-- Family journal, phase 2: the shared family feed.
--
-- Phase 1 (00052) added journal_entries.visibility and wrote the entries SELECT
-- policy in its final form ("own rows OR visibility = 'family'"), but left the
-- child tables (journal_messages, journal_entry_photos) and the storage bucket
-- owner-only. This migration opens those reads for *closed, family* entries so a
-- member can read another member's shared entry in full, lets members read each
-- other's name for author attribution, indexes the family feed, and seeds the
-- family-followup question type.
--
-- The `status = 'closed'` clause on every family read seam is deliberate: an
-- entry whose visibility toggle is flipped to 'family' while it's still being
-- written shouldn't expose its transcript before the author has finished and
-- committed to sharing. The family feed only surfaces closed entries too.

-- ============================================================
-- 1. Child-table read seams: own rows, or any closed family entry's children
-- ============================================================
DROP POLICY "Own rows" ON journal_messages;
CREATE POLICY "Read own or family" ON journal_messages FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM journal_entries e
      WHERE e.id = journal_messages.entry_id
        AND e.visibility = 'family'
        AND e.status = 'closed'
    )
  );
CREATE POLICY "Insert own" ON journal_messages FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own" ON journal_messages FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own" ON journal_messages FOR DELETE USING (user_id = auth.uid());

DROP POLICY "Own rows" ON journal_entry_photos;
CREATE POLICY "Read own or family" ON journal_entry_photos FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM journal_entries e
      WHERE e.id = journal_entry_photos.entry_id
        AND e.visibility = 'family'
        AND e.status = 'closed'
    )
  );
CREATE POLICY "Insert own" ON journal_entry_photos FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own" ON journal_entry_photos FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own" ON journal_entry_photos FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 2. Storage-bucket seam: read another member's photo *files* for a closed
--    family entry. The path is {auth.uid()}/{entry_id}/{file}, so foldername()[2]
--    is the entry id. Owner-scoped read/write policies from 00043/00044 stay.
-- ============================================================
CREATE POLICY "journal-photos family select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'journal-photos'
    AND EXISTS (
      SELECT 1 FROM journal_entries e
      WHERE e.id::text = (storage.foldername(name))[2]
        AND e.visibility = 'family'
        AND e.status = 'closed'
    )
  );

-- ============================================================
-- 3. Author attribution: let any authenticated member read every member's row
--    (names are already non-secret within a family via the shared family doc).
--    Writes stay service-role only.
-- ============================================================
DROP POLICY "Read own membership" ON journal_members;
CREATE POLICY "Read all members" ON journal_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 4. Family-feed index: the feed reads closed family entries newest-first by
--    entry_date (same ordering as the Mine feed).
-- ============================================================
CREATE INDEX idx_journal_entries_family
  ON journal_entries (entry_date DESC, created_at DESC)
  WHERE visibility = 'family' AND status = 'closed';

-- ============================================================
-- 5. Built-in "family-followup" question type for every existing user
-- ============================================================
-- Medium cadence (weight 3, enabled), mirroring how reminiscence was seeded in
-- 00056. sort_order 19 follows the 18 existing built-ins. New members copy the
-- owner's tuned set (which now includes this row) via provisioning; the very
-- first owner on a fresh DB gets it from BUILTIN_QUESTION_TYPES in code.
INSERT INTO journal_question_types
  (user_id, name, base_description, style_note, weight, enabled, is_builtin, sort_order)
SELECT DISTINCT user_id,
  'family-followup',
  'Draws on a recent entry another family member shared to the family feed and asks the user about it, referencing that member by name (e.g. "Jenny wrote about the camping trip — how was that for you?"). Only fires when another member has shared something.',
  '',
  3, true, true, 19
FROM journal_question_types
ON CONFLICT (user_id, name) DO NOTHING;
