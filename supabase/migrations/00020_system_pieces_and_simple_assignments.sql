-- Unify technique/sight_reading as system pieces & simplify assignments
-- ====================================================================

-- Step 1: Add kind column to pieces
ALTER TABLE pieces ADD COLUMN kind text NOT NULL DEFAULT 'piece';
ALTER TABLE pieces ADD CONSTRAINT pieces_kind_check CHECK (kind IN ('piece', 'technique', 'sight_reading'));

-- Step 2: Insert system pieces with well-known UUIDs
INSERT INTO pieces (id, name, composer, status, kind, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Technique', '', 'active', 'technique', -2),
  ('00000000-0000-0000-0000-000000000002', 'Sight Reading', '', 'active', 'sight_reading', -1);

-- Step 3: Migrate timer_entries to use system piece IDs
UPDATE timer_entries SET piece_id = '00000000-0000-0000-0000-000000000001'
  WHERE category = 'technique' AND piece_id IS NULL;
UPDATE timer_entries SET piece_id = '00000000-0000-0000-0000-000000000002'
  WHERE category = 'sight_reading' AND piece_id IS NULL;

-- Step 4: Migrate practice_entry_sections to use system piece IDs
UPDATE practice_entry_sections SET piece_id = '00000000-0000-0000-0000-000000000001'
  WHERE category = 'technique' AND piece_id IS NULL;
UPDATE practice_entry_sections SET piece_id = '00000000-0000-0000-0000-000000000002'
  WHERE category = 'sight_reading' AND piece_id IS NULL;

-- Update category for migrated sections
UPDATE practice_entry_sections SET category = 'piece'
  WHERE category IN ('technique', 'sight_reading');

-- Step 5: Migrate assignments - set piece_id for those linked to technique/sight_reading sections
UPDATE assignments a
  SET piece_id = pes.piece_id
  FROM practice_entry_sections pes
  WHERE a.source_id = pes.id
    AND a.piece_id IS NULL
    AND pes.piece_id IS NOT NULL;

-- Delete any remaining assignments with no piece_id (orphans from general sections)
DELETE FROM assignments WHERE piece_id IS NULL;

-- Step 6: Simplify assignments table
ALTER TABLE assignments ADD COLUMN completed boolean NOT NULL DEFAULT false;
UPDATE assignments SET completed = (progress = 4);
ALTER TABLE assignments DROP COLUMN progress;
ALTER TABLE assignments DROP COLUMN source_type;
ALTER TABLE assignments DROP COLUMN source_id;
ALTER TABLE assignments DROP COLUMN note;

-- Make piece_id NOT NULL now that all assignments have one
ALTER TABLE assignments ALTER COLUMN piece_id SET NOT NULL;

-- Step 7: Drop category column from timer_entries
ALTER TABLE timer_entries DROP COLUMN category;
DROP TYPE timer_category;

-- Step 8: Simplify entry_section_category enum
-- Cannot alter enum values directly in postgres, so recreate
ALTER TABLE practice_entry_sections ALTER COLUMN category TYPE text;
DROP TYPE entry_section_category;
CREATE TYPE entry_section_category AS ENUM ('piece', 'general');
ALTER TABLE practice_entry_sections ALTER COLUMN category TYPE entry_section_category
  USING category::entry_section_category;

-- Step 9: Make piece_id NOT NULL on timer_entries (all entries now have one)
ALTER TABLE timer_entries ALTER COLUMN piece_id SET NOT NULL;
