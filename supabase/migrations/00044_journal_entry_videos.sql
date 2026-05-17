-- Allow journal entries to hold videos alongside photos.
-- A video reuses the existing path slots: original_path is the uploaded video,
-- display_path is a poster frame (JPEG) extracted in the browser.
ALTER TABLE journal_entry_photos
  ADD COLUMN media_type text NOT NULL DEFAULT 'photo'
    CHECK (media_type IN ('photo', 'video'));

-- Widen the bucket to accept video and lift the size cap to 200MB.
UPDATE storage.buckets
SET
  file_size_limit = 200 * 1024 * 1024,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/ogg'
  ]
WHERE id = 'journal-photos';
