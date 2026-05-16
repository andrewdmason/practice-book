-- Photos attached to a journal entry. An entry can hold multiple photos.
CREATE TABLE journal_entry_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  original_path text NOT NULL,
  display_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_entry_photos_entry
  ON journal_entry_photos (entry_id, created_at);

ALTER TABLE journal_entry_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON journal_entry_photos FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Private bucket for journal photos. Path convention:
-- {auth.uid()}/{entry_id}/{photo_id}-original.{ext} and
-- {auth.uid()}/{entry_id}/{photo_id}-display.jpg
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'journal-photos',
  'journal-photos',
  false,
  25 * 1024 * 1024,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "journal-photos owner select" ON storage.objects;
DROP POLICY IF EXISTS "journal-photos owner insert" ON storage.objects;
DROP POLICY IF EXISTS "journal-photos owner update" ON storage.objects;
DROP POLICY IF EXISTS "journal-photos owner delete" ON storage.objects;

CREATE POLICY "journal-photos owner select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "journal-photos owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "journal-photos owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "journal-photos owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
