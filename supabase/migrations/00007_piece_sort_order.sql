-- Add sort_order to pieces for manual ordering of active repertoire
ALTER TABLE pieces ADD COLUMN sort_order int NOT NULL DEFAULT 0;

-- Initialize sort_order alphabetically for existing active pieces
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM pieces
  WHERE status = 'active'
)
UPDATE pieces SET sort_order = ranked.rn
FROM ranked WHERE pieces.id = ranked.id;
