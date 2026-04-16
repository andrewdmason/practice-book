-- Drop the old tables that have been consolidated into practice_tasks.
-- This migration should only be run after verifying the new code works correctly.
-- ====================================================================

-- Drop tables (CASCADE handles foreign key dependencies)
DROP TABLE IF EXISTS timer_entries CASCADE;
DROP TABLE IF EXISTS practice_sessions CASCADE;
DROP TABLE IF EXISTS practice_entry_sections CASCADE;
DROP TABLE IF EXISTS practice_entries CASCADE;

-- Drop orphaned enum types
DROP TYPE IF EXISTS entry_section_category;
