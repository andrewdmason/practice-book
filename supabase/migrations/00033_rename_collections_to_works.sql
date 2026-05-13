-- Rename "collection" to "work" across the schema. In this product, a
-- "work" is an optional parent of pieces (e.g. a Bach French Suite that
-- contains its dances). The previous name "collection" suggested arbitrary
-- curated groupings, which is not what we're modelling here.

ALTER TABLE collections RENAME TO works;
ALTER TABLE pieces RENAME COLUMN collection_id TO work_id;

ALTER INDEX idx_collections_search RENAME TO idx_works_search;
ALTER INDEX idx_pieces_collection_id RENAME TO idx_pieces_work_id;

ALTER TRIGGER collections_updated_at ON works RENAME TO works_updated_at;

-- Rebuild search_all to use the renamed table and emit 'work' result type
-- pointed at /repertoire/works/<id>.
DROP FUNCTION IF EXISTS search_all;
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
    SELECT
      'work'::text,
      w.id,
      w.name,
      w.composer,
      ts_headline('english', coalesce(w.notes, ''), q,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10'),
      w.created_at::date,
      '/repertoire/works/' || w.id,
      ts_rank(w.search_vector, q)
    FROM works w
    WHERE w.search_vector @@ q
  )
  UNION ALL
  (
    SELECT
      'practice_entry'::text,
      pt.id,
      COALESCE(pc.name, 'General Notes'),
      pt.date::text,
      ts_headline('english', pt.text, q,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10'),
      pt.date,
      '/?date=' || pt.date,
      ts_rank(to_tsvector('english', pt.text), q)
    FROM practice_tasks pt
    LEFT JOIN pieces pc ON pc.id = pt.piece_id
    WHERE pt.text != ''
      AND to_tsvector('english', pt.text) @@ q
  )
  UNION ALL
  (
    SELECT
      'lesson'::text,
      le.id,
      COALESCE(pc.name, 'Lesson'),
      COALESCE(l.date::text, le.date::text),
      ts_headline('english', le.notes, q,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10'),
      COALESCE(l.date, le.date),
      '/lessons/' || le.lesson_id,
      ts_rank(to_tsvector('english', le.notes), q)
    FROM lesson_entries le
    JOIN lessons l ON l.id = le.lesson_id
    LEFT JOIN pieces pc ON pc.id = le.piece_id
    WHERE le.notes != ''
      AND to_tsvector('english', le.notes) @@ q
  )
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;
