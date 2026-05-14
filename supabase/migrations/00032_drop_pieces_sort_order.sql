-- Drop the manual sort_order column from pieces. The repertoire view now
-- groups by composer/collection and sorts alphabetically; ordering is no
-- longer user-controlled at the piece level.
ALTER TABLE pieces DROP COLUMN sort_order;
