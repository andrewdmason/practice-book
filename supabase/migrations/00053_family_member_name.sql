-- Family members get a display name, set by the owner when adding them (and
-- shown in the Family settings screen + the dev user switcher).

ALTER TABLE journal_members ADD COLUMN name text;

-- Name the existing owner so the Family list isn't blank for them.
UPDATE journal_members SET name = 'Andrew' WHERE is_owner AND name IS NULL;
