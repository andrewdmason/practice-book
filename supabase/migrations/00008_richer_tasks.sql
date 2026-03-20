-- Replace completed boolean with progress integer (0-4)
ALTER TABLE tasks ADD COLUMN progress integer NOT NULL DEFAULT 0;
UPDATE tasks SET progress = CASE WHEN completed THEN 4 ELSE 0 END;
ALTER TABLE tasks DROP COLUMN completed;

-- Add completion date (set for already-completed tasks)
ALTER TABLE tasks ADD COLUMN completed_at timestamptz;
UPDATE tasks SET completed_at = updated_at WHERE progress = 4;

-- Add notes
ALTER TABLE tasks ADD COLUMN note text;

-- Drop style column (no more goal vs default distinction)
ALTER TABLE tasks DROP COLUMN style;
