-- Add sort_order to assignments so they can be reordered within a piece
ALTER TABLE assignments ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- Backfill: within each piece, newest-first gets lowest sort_order (preserves
-- current display order since open assignments were sorted by created_at DESC).
UPDATE assignments a
SET sort_order = sub.rn - 1
FROM (
  SELECT id, row_number() OVER (PARTITION BY piece_id ORDER BY created_at DESC) AS rn
  FROM assignments
) sub
WHERE a.id = sub.id;

CREATE INDEX idx_assignments_piece_sort ON assignments(piece_id, sort_order);
