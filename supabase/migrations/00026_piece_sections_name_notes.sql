-- Add optional descriptive name and freeform notes to piece sections
ALTER TABLE piece_sections ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE piece_sections ADD COLUMN IF NOT EXISTS notes text;
