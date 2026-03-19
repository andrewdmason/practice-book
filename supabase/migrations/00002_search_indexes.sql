-- Practice Book: Search indexes and full-text search
-- Adds tiptap_to_text function, GIN indexes, and search_all RPC.

-- ============================================================
-- Tiptap JSONB → plain text extraction
-- ============================================================

CREATE OR REPLACE FUNCTION tiptap_to_text(doc jsonb)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  result text := '';
  element jsonb;
  arr jsonb;
BEGIN
  IF doc IS NULL THEN
    RETURN '';
  END IF;

  -- If this node has a "text" key, return it
  IF doc ? 'text' THEN
    RETURN doc->>'text';
  END IF;

  -- If this node has a "content" array, recurse into children
  IF doc ? 'content' AND jsonb_typeof(doc->'content') = 'array' THEN
    arr := doc->'content';
    FOR i IN 0..jsonb_array_length(arr) - 1 LOOP
      element := arr->i;
      result := result || ' ' || tiptap_to_text(element);
    END LOOP;
  END IF;

  RETURN btrim(result);
END;
$$;

-- ============================================================
-- Generated tsvector columns + GIN indexes on text tables
-- ============================================================

ALTER TABLE pieces ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(composer, '') || ' ' || coalesce(notes, ''))
  ) STORED;
CREATE INDEX idx_pieces_search ON pieces USING gin(search_vector);

ALTER TABLE collections ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(composer, '') || ' ' || coalesce(notes, ''))
  ) STORED;
CREATE INDEX idx_collections_search ON collections USING gin(search_vector);

ALTER TABLE bookmarks ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, ''))
  ) STORED;
CREATE INDEX idx_bookmarks_search ON bookmarks USING gin(search_vector);

ALTER TABLE goals ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(text, '') || ' ' || coalesce(note, ''))
  ) STORED;
CREATE INDEX idx_goals_search ON goals USING gin(search_vector);

-- ============================================================
-- Unified search RPC
-- ============================================================

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
  -- Parse query; return empty if invalid
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
    -- Practice entry sections (query-time tsvector on JSONB)
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
    -- Lessons (query-time tsvector on JSONB)
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
    -- Goals
    SELECT
      'goal'::text,
      g.id,
      left(g.text, 80),
      'Goal',
      ts_headline('english', coalesce(g.text, '') || ' ' || coalesce(g.note, ''), q,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10'),
      l.date,
      '/lessons/' || g.lesson_id,
      ts_rank(g.search_vector, q)
    FROM goals g
    JOIN lessons l ON l.id = g.lesson_id
    WHERE g.search_vector @@ q
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
