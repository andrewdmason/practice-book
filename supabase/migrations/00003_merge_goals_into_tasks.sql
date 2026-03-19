-- Merge goals into tasks: add style column, migrate data, drop goals table.

-- 1. Add style column to tasks
ALTER TABLE tasks ADD COLUMN style text NOT NULL DEFAULT 'default';

-- 2. Migrate existing goals into tasks
INSERT INTO tasks (id, source_type, source_id, piece_id, text, completed, style, created_at, updated_at)
SELECT
  g.id,
  'lesson'::source_type,
  g.lesson_id,
  g.piece_id,
  g.text,
  g.completed,
  'goal',
  g.created_at,
  g.updated_at
FROM goals g;

-- 3. Drop goals table (cascades search_vector column, index, RLS policy)
DROP TABLE goals;

-- 4. Recreate search_all RPC without goals UNION ALL block
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
    -- Practice entry sections
    SELECT
      'practice_entry'::text,
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
      '/?date=' || pe.date,
      ts_rank(to_tsvector('english', tiptap_to_text(pes.content)), q)
    FROM practice_entry_sections pes
    JOIN practice_entries pe ON pe.id = pes.practice_entry_id
    LEFT JOIN pieces pc ON pc.id = pes.piece_id
    WHERE pes.content IS NOT NULL
      AND to_tsvector('english', tiptap_to_text(pes.content)) @@ q
  )
  UNION ALL
  (
    -- Lessons
    SELECT
      'lesson'::text,
      l.id,
      'Lesson',
      l.date::text,
      ts_headline('english', tiptap_to_text(l.content), q,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10'),
      l.date,
      '/lessons/' || l.id,
      ts_rank(to_tsvector('english', tiptap_to_text(l.content)), q)
    FROM lessons l
    WHERE l.content IS NOT NULL
      AND to_tsvector('english', tiptap_to_text(l.content)) @@ q
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
