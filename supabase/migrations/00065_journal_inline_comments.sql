-- Inline family comments: family members leave comments anchored between the
-- content blocks of each other's finished, shared posts.
--
-- A comment belongs to one entry, one commenter, and one block index (the
-- ordinal position of a paragraph / message / the quote within the entry —
-- see src/lib/journal/entry-blocks.ts). Comments are flat: multiple at the same
-- block_index stack in created_at order, which reads as a conversation without
-- formal threading.
--
-- Like the other family read seams (00058), every cross-member access is gated
-- on the parent entry being visibility='family' AND status='closed': you can
-- only comment on, and see comments on, a post that's finished and shared.

CREATE TABLE journal_inline_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- the commenter
  block_index integer NOT NULL CHECK (block_index >= 0),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The read path fetches every comment for one entry and groups/orders them
-- client-side; this index serves that lookup and the in-block ordering.
CREATE INDEX idx_journal_inline_comments_entry
  ON journal_inline_comments (entry_id, block_index, created_at);

CREATE TRIGGER journal_inline_comments_updated_at
  BEFORE UPDATE ON journal_inline_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE journal_inline_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: your own comments, plus every comment on a closed family entry. Mirror
-- of the journal_messages "Read own or family" seam in 00058.
CREATE POLICY "Read own or family" ON journal_inline_comments FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM journal_entries e
      WHERE e.id = journal_inline_comments.entry_id
        AND e.visibility = 'family'
        AND e.status = 'closed'
    )
  );

-- INSERT: only your own row, only on a closed family entry, and only if you're a
-- provisioned family member (a journal_members row links to your user_id).
CREATE POLICY "Insert own on family" ON journal_inline_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM journal_entries e
      WHERE e.id = journal_inline_comments.entry_id
        AND e.visibility = 'family'
        AND e.status = 'closed'
    )
    AND EXISTS (
      SELECT 1 FROM journal_members m
      WHERE m.user_id = auth.uid()
    )
  );

-- UPDATE: a comment's author edits their own words; nobody edits another's.
CREATE POLICY "Update own" ON journal_inline_comments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: the comment's author, or the account owner (moderation).
CREATE POLICY "Delete own or owner" ON journal_inline_comments FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM journal_members m
      WHERE m.user_id = auth.uid() AND m.is_owner = true
    )
  );
