-- Add optional descriptive name and freeform notes to piece sections
ALTER TABLE piece_sections ADD COLUMN name text;
ALTER TABLE piece_sections ADD COLUMN notes text;
