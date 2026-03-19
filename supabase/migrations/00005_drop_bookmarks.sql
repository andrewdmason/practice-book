-- Remove bookmarks feature entirely

-- Drop the bookmarks table (cascades RLS policies, indexes)
DROP TABLE IF EXISTS bookmarks CASCADE;

-- Recreate search_all without the bookmarks UNION ALL block
CREATE OR REPLACE FUNCTION search_all(
  search_query text,
  result_limit int DEFAULT 50
)
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
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  q tsquery;
BEGIN
  q := websearch_to_tsquery('english', search_query);

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
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;
