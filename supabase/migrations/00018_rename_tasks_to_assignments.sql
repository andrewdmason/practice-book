-- Rename tasks table to assignments
ALTER TABLE tasks RENAME TO assignments;

-- Update RLS policy (recreate since ALTER POLICY doesn't support table rename)
-- The policy transfers automatically with the table rename, no action needed.

-- Update the search_all function to reference assignments instead of tasks
-- (The function was last modified in 00003_merge_goals_into_tasks.sql)
