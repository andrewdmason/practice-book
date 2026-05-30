-- Track AI-generated journal photos from request through preview/attachment.
-- Rows are private to the entry author; generated images that get attached are
-- surfaced through the existing journal_entry_photos table and storage policies.

CREATE TABLE journal_image_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'succeeded', 'attached', 'failed', 'skipped')),
  mode text NOT NULL
    CHECK (mode IN ('auto', 'manual')),
  attach_on_success boolean NOT NULL DEFAULT false,
  reference_member_email text,
  reference_member_name text,
  reference_photo_id uuid REFERENCES journal_member_photos(id) ON DELETE SET NULL,
  reference_storage_path text,
  prompt text,
  generated_path text,
  display_path text,
  attached_photo_id uuid REFERENCES journal_entry_photos(id) ON DELETE SET NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_journal_image_generations_entry_created
  ON journal_image_generations (entry_id, created_at DESC);

CREATE INDEX idx_journal_image_generations_user_status
  ON journal_image_generations (user_id, status, created_at DESC);

CREATE TRIGGER journal_image_generations_updated_at
  BEFORE UPDATE ON journal_image_generations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE journal_image_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own rows" ON journal_image_generations FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
