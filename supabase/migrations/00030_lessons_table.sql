-- Promote lessons to a first-class entity.
-- Introduces a lessons table with the concept of an "upcoming" lesson
-- (completed_at IS NULL), points lesson_entries at it via a FK, and
-- backfills existing per-date rows. Also updates search_all to use the
-- new /lessons/<id> URL.
-- ====================================================================

CREATE TABLE lessons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_lessons_date ON lessons(date DESC NULLS LAST);
CREATE INDEX idx_lessons_upcoming ON lessons(completed_at) WHERE completed_at IS NULL;

CREATE TRIGGER lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON lessons FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE lesson_entries ADD COLUMN lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE;
CREATE INDEX idx_lesson_entries_lesson_id ON lesson_entries(lesson_id);

INSERT INTO lessons (id, date, completed_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  d.date,
  (d.date::timestamptz + interval '12 hours'),
  MIN(le.created_at),
  MAX(le.updated_at)
FROM (SELECT DISTINCT date FROM lesson_entries) d
JOIN lesson_entries le ON le.date = d.date
GROUP BY d.date;

UPDATE lesson_entries le
SET lesson_id = l.id
FROM lessons l
WHERE l.date = le.date;

ALTER TABLE lesson_entries ALTER COLUMN lesson_id SET NOT NULL;
ALTER TABLE lesson_entries ALTER COLUMN date DROP NOT NULL;

INSERT INTO lessons (date, completed_at) VALUES (NULL, NULL);

-- Update search_all so lesson results link to /lessons/<lesson.id>
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
