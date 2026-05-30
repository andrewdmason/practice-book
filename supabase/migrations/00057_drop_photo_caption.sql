-- Captions on photos added unneeded complexity; remove the column.
ALTER TABLE journal_entry_photos DROP COLUMN IF EXISTS caption;
