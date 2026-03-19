-- Consolidate lessons into practice_entries with a type discriminator.
-- Lessons become practice entries with type='lesson', using the same sections model.

-- 1. Add type column to practice_entries
ALTER TABLE practice_entries ADD COLUMN type text NOT NULL DEFAULT 'practice';

-- 2. Drop the UNIQUE(date) constraint (lessons + practice can share dates, multiple lessons per day)
ALTER TABLE practice_entries DROP CONSTRAINT practice_entries_date_key;

-- 3. Migrate lessons into practice_entries
INSERT INTO practice_entries (id, date, type, created_at, updated_at)
SELECT id, date, 'lesson', created_at, updated_at
FROM lessons;

-- 4. For each lesson with content, create a 'general' section
INSERT INTO practice_entry_sections (id, practice_entry_id, piece_id, category, content, sort_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  l.id,
  NULL,
  'general',
  l.content,
  0,
  l.created_at,
  l.updated_at
FROM lessons l
WHERE l.content IS NOT NULL;

-- 5. For lessons with NULL content, still create an empty general section
INSERT INTO practice_entry_sections (id, practice_entry_id, piece_id, category, content, sort_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  l.id,
  NULL,
  'general',
  NULL,
  0,
  l.created_at,
  l.updated_at
FROM lessons l
WHERE l.content IS NULL;

-- 6. Repoint tasks: source_type='lesson' → source_type='practice_entry'
-- source_id currently points to lesson.id, which is now a practice_entry.id
-- But source_id for practice_entry tasks points to SECTION id, not entry id.
-- We need to repoint lesson tasks to the new general section.
UPDATE tasks t
SET
  source_type = 'practice_entry',
  source_id = pes.id
FROM practice_entry_sections pes
WHERE t.source_type = 'lesson'
  AND pes.practice_entry_id = t.source_id
  AND pes.category = 'general';

-- 7. Repoint mentions: same logic
UPDATE mentions m
SET
  source_type = 'practice_entry',
  source_id = pes.id
FROM practice_entry_sections pes
WHERE m.source_type = 'lesson'
  AND pes.practice_entry_id = m.source_id
  AND pes.category = 'general';

-- 8. Drop the lessons table (and its RLS policy, triggers, indexes)
DROP TABLE lessons CASCADE;

-- 9. Update source_type enum: remove 'lesson' value
-- PostgreSQL doesn't support DROP VALUE from enum, so we replace it:
-- First update any remaining references (should be none after steps 6-7)
-- Then recreate the column without the enum (use text, which is simpler)
ALTER TABLE tasks ALTER COLUMN source_type TYPE text;
ALTER TABLE mentions ALTER COLUMN source_type TYPE text;

-- Drop the old enum type
DROP TYPE source_type;

-- 10. Update search_all to remove lessons block and use entry type for result_type
CREATE OR REPLACE FUNCTION search_all(query_text text, result_limit int DEFAULT 20)
RETURNS TABLE (
  result_type text,
  id uuid,
  title text,
  subtitle text,
  preview text,
  date date,
  url text,
  rank real
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  q tsquery;
BEGIN
  BEGIN
    q := websearch_to_tsquery('english', query_text);
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  IF q IS NULL OR q = ''::tsquery THEN
    RETURN;
  END IF;

  RETURN QUERY
  (
    -- Pieces
    SELECT
      'piece'::text AS result_type,
      p.id,
      p.name AS title,
      p.composer AS subtitle,
      ts_headline('english', coalesce(p.notes, ''), q,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10') AS preview,
      p.created_at::date AS date,
      '/repertoire/' || p.id AS url,
      ts_rank(p.search_vector, q) AS rank
    FROM pieces p
    WHERE p.search_vector @@ q
  )
  UNION ALL
  (
    -- Collections
    SELECT
      'collection'::text,
      c.id,
      c.name,
      c.composer,
      ts_headline('english', coalesce(c.notes, ''), q,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10'),
      c.created_at::date,
      '/repertoire/collections/' || c.id,
      ts_rank(c.search_vector, q)
    FROM collections c
    WHERE c.search_vector @@ q
  )
  UNION ALL
  (
    -- Practice entry sections (covers both practice and lesson entries)
    SELECT
      CASE pe.type
        WHEN 'lesson' THEN 'lesson'::text
        ELSE 'practice_entry'::text
      END,
      pes.id,
      CASE pes.category
        WHEN 'piece' THEN coalesce(pc.name, 'Piece')
        WHEN 'technique' THEN 'Technique'
        WHEN 'sight_reading' THEN 'Sight Reading'
        ELSE 'General Notes'
      END,
      pe.date::text,
      ts_headline('english', tiptap_to_text(pes.content), q,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10'),
      pe.date,
      CASE pe.type
        WHEN 'lesson' THEN '/lessons/' || pe.id
        ELSE '/?date=' || pe.date
      END,
      ts_rank(to_tsvector('english', tiptap_to_text(pes.content)), q)
    FROM practice_entry_sections pes
    JOIN practice_entries pe ON pe.id = pes.practice_entry_id
    LEFT JOIN pieces pc ON pc.id = pes.piece_id
    WHERE pes.content IS NOT NULL
      AND to_tsvector('english', tiptap_to_text(pes.content)) @@ q
  )
  UNION ALL
  (
    -- Bookmarks
    SELECT
      'bookmark'::text,
      b.id,
      b.name,
      pc.name,
      'mm. ' || b.measure_start || coalesce(' – ' || b.measure_end, ''),
      b.created_at::date,
      '/repertoire/' || b.piece_id,
      ts_rank(b.search_vector, q)
    FROM bookmarks b
    JOIN pieces pc ON pc.id = b.piece_id
    WHERE b.search_vector @@ q
  )
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;
