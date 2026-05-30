-- Profile photos for family members.
--
-- Renumbered 00059 -> 00061: PR #190's question-types migration also shipped as
-- 00059 and reached prod first, claiming version 00059 in
-- supabase_migrations.schema_migrations. Because that table is keyed by version
-- alone, `supabase db push` then treated *this* migration as already applied and
-- silently skipped it, so the journal_member_photos table was never created on
-- prod (the /settings/family page 500'd: "Could not find the table
-- public.journal_member_photos"). This copy takes a fresh, unused version so it
-- actually runs, and every statement is idempotent so it is safe on the shared
-- local dev DB (where 00059 already created the table) and on a clean db reset.
--
-- The account owner can attach photos to each member from the Family settings
-- tab. A member can have several photos with exactly one marked primary; the
-- primary is shown as an avatar thumbnail next to the member's posts in the
-- shared family feed. Keyed by member_email (not user_id): invited members have
-- a null user_id until their first sign-in, but the owner can set their photo
-- immediately. Writes go through the service role in owner-gated server actions,
-- so only a read policy is needed (mirroring "Read all members" in 00058 —
-- photos, like names, are non-secret within a family).

CREATE TABLE IF NOT EXISTS journal_member_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_email text NOT NULL REFERENCES journal_members(email) ON DELETE CASCADE,
  storage_path text NOT NULL,
  is_primary   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_member_photos_member
  ON journal_member_photos (member_email);

-- At most one primary per member.
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_member_photos_primary
  ON journal_member_photos (member_email)
  WHERE is_primary;

ALTER TABLE journal_member_photos ENABLE ROW LEVEL SECURITY;

-- Any authenticated member can read the metadata (for author avatars in the
-- shared feed). Writes are service-role only.
DROP POLICY IF EXISTS "Read all member photos" ON journal_member_photos;
CREATE POLICY "Read all member photos" ON journal_member_photos FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Private bucket for member profile photos. Path: {member_email}/{photo_id}.jpg
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'member-photos',
  'member-photos',
  false,
  25 * 1024 * 1024,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Any authenticated member can read the photo *files* (shown as feed avatars).
-- Writes/deletes go through the service role in owner-gated server actions, so
-- no insert/update/delete storage policy is needed.
DROP POLICY IF EXISTS "member-photos authenticated select" ON storage.objects;
CREATE POLICY "member-photos authenticated select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'member-photos' AND auth.uid() IS NOT NULL);
