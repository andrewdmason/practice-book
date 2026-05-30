-- Let the account owner edit a family member's email from Family settings.
--
-- journal_member_photos.member_email FKs journal_members(email), the member's
-- primary key / allowlist key. The original 00061 constraint was ON DELETE
-- CASCADE only, so renaming a member's email would fail the FK check whenever
-- that member already had photo rows. Add ON UPDATE CASCADE so a rename carries
-- the member's photo rows with it. (Stored file *paths* keep their original
-- {email}/ prefix — storage_path is the source of truth and still resolves, so
-- only new uploads land under the new folder. That's fine.)
--
-- Idempotent: drop the constraint by its default name and recreate it.

ALTER TABLE journal_member_photos
  DROP CONSTRAINT IF EXISTS journal_member_photos_member_email_fkey;

ALTER TABLE journal_member_photos
  ADD CONSTRAINT journal_member_photos_member_email_fkey
  FOREIGN KEY (member_email) REFERENCES journal_members(email)
  ON UPDATE CASCADE ON DELETE CASCADE;
