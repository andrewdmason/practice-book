-- Consolidate practice_sessions, timer_entries, practice_entries, and
-- practice_entry_sections into practice_tasks.
-- Lessons are extracted into their own lesson_entries table.
-- This is an ADDITIVE migration — old tables are NOT dropped yet.
-- ====================================================================

-- Step 1: Schema changes to practice_tasks
-- ====================================================================

-- Allow tasks with no piece (for free-text notes)
ALTER TABLE practice_tasks ALTER COLUMN piece_id DROP NOT NULL;

-- Track when a task's timer was actively running
ALTER TABLE practice_tasks ADD COLUMN started_at timestamptz;
ALTER TABLE practice_tasks ADD COLUMN ended_at timestamptz;

-- Step 2: Create lesson_entries table
-- One row per (date, piece?) with free-text notes from a lesson.
-- ====================================================================

CREATE TABLE lesson_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  piece_id uuid REFERENCES pieces(id) ON DELETE CASCADE,
  date date NOT NULL,
  notes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_lesson_entries_date ON lesson_entries(date DESC);
CREATE INDEX idx_lesson_entries_piece_id ON lesson_entries(piece_id);

CREATE TRIGGER lesson_entries_updated_at
  BEFORE UPDATE ON lesson_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lesson_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON lesson_entries FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Step 3: Migrate timer_entries → practice_tasks
-- Each timer_entry with recorded time becomes a completed task.
-- ====================================================================

INSERT INTO practice_tasks (
  piece_id, section_id, date, text, timer_seconds, timer_remaining_seconds,
  completed, completed_at, sort_order, started_at, ended_at, created_at, updated_at
)
SELECT
  te.piece_id,
  te.section_id,
  ps.date,
  '',  -- no text for timer-derived tasks
  EXTRACT(EPOCH FROM (te.ended_at - te.started_at))::integer,
  0,   -- fully elapsed
  true,
  te.ended_at,
  0,
  te.started_at,
  te.ended_at,
  te.started_at,
  te.ended_at
FROM timer_entries te
JOIN practice_sessions ps ON ps.id = te.session_id
WHERE te.started_at IS NOT NULL
  AND te.ended_at IS NOT NULL;

-- Step 4: Migrate practice_entry_sections
-- Practice-type entries → practice_tasks.
-- Lesson-type entries → lesson_entries.
-- Convert TipTap JSON content to plain text using existing tiptap_to_text().
-- ====================================================================

INSERT INTO practice_tasks (
  piece_id, date, text, timer_seconds, timer_remaining_seconds,
  completed, sort_order, created_at, updated_at
)
SELECT
  pes.piece_id,
  pe.date,
  COALESCE(tiptap_to_text(pes.content), ''),
  0,    -- no timer for journal-derived tasks
  0,
  true, -- historical entries are completed
  pes.sort_order,
  pes.created_at,
  pes.updated_at
FROM practice_entry_sections pes
JOIN practice_entries pe ON pe.id = pes.practice_entry_id
WHERE pe.type = 'practice'
  AND pes.content IS NOT NULL
  AND tiptap_to_text(pes.content) != '';

INSERT INTO lesson_entries (
  piece_id, date, notes, sort_order, created_at, updated_at
)
SELECT
  pes.piece_id,
  pe.date,
  COALESCE(tiptap_to_text(pes.content), ''),
  pes.sort_order,
  pes.created_at,
  pes.updated_at
FROM practice_entry_sections pes
JOIN practice_entries pe ON pe.id = pes.practice_entry_id
WHERE pe.type = 'lesson'
  AND pes.content IS NOT NULL
  AND tiptap_to_text(pes.content) != '';

-- Step 5: Update search_all to query practice_tasks and lesson_entries
-- ====================================================================

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
    -- Practice tasks with text content
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
    -- Lesson entries
    SELECT
      'lesson'::text,
      le.id,
      COALESCE(pc.name, 'Lesson'),
      le.date::text,
      ts_headline('english', le.notes, q,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10'),
      le.date,
      '/lessons#' || le.id,
      ts_rank(to_tsvector('english', le.notes), q)
    FROM lesson_entries le
    LEFT JOIN pieces pc ON pc.id = le.piece_id
    WHERE le.notes != ''
      AND to_tsvector('english', le.notes) @@ q
  )
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;
