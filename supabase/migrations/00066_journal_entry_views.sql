-- Per-user read state for the notification badge: the last time a user opened a
-- given entry's page. One row per (user, entry); the timestamp is bumped to
-- now() each time the user views the post.
--
-- This single timestamp drives both notification reasons and their dismissal:
--   * A shared post is "new" to you until you have a view row for it.
--   * A comment by someone else counts as unread while its created_at is newer
--     than your last view (or you've never viewed the post).
-- Opening /journal/[id] upserts last_viewed_at = now(), clearing both at once;
-- a later comment naturally re-triggers because its created_at is newer again.
--
-- Unlike the family read seams (00058, 00065), this table is purely private:
-- it's each user's own bookkeeping, never read across members, so every policy
-- is a plain own-rows-only check.

CREATE TABLE journal_entry_views (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entry_id)
);

ALTER TABLE journal_entry_views ENABLE ROW LEVEL SECURITY;

-- Every access is your own row only — this is private read state, not a family
-- read seam.
CREATE POLICY "Read own" ON journal_entry_views FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Insert own" ON journal_entry_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own" ON journal_entry_views FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Delete own" ON journal_entry_views FOR DELETE
  USING (user_id = auth.uid());
