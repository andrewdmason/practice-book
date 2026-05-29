-- Shared family context: a single owner-authored doc that every family member's
-- interviewer can read (and that seeds the "build your profile" chatbot prompt).
-- There's one family, so this is a single row. Readable by all members; writes
-- go through an owner-checked server action using the service role.

CREATE TABLE journal_family (
  id         int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content    text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER journal_family_updated_at
  BEFORE UPDATE ON journal_family
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE journal_family ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family readable" ON journal_family FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed with the current family. The owner edits this in Settings → Family.
INSERT INTO journal_family (id, content) VALUES (1, $seed$# The Mason family

The people in this family:

- Andrew — dad. Owns this journal.
- Jenny — mom. Coordinates the family calendar.
- Sebastian — son, 12.
- Oscar — son, 9.
$seed$);
