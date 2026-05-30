-- Tag journal media by origin so future exports/printed journals can exclude
-- AI-generated images with a simple column filter.

ALTER TABLE journal_entry_photos
  ADD COLUMN source text NOT NULL DEFAULT 'uploaded'
    CHECK (source IN ('uploaded', 'ai_generated'));

-- Backfill any generated photos attached before this column existed. Uploaded
-- photos keep the default.
UPDATE journal_entry_photos
SET source = 'ai_generated'
WHERE id IN (
  SELECT attached_photo_id
  FROM journal_image_generations
  WHERE attached_photo_id IS NOT NULL
);

CREATE INDEX idx_journal_entry_photos_source
  ON journal_entry_photos (source);
