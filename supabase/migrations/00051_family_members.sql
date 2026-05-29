-- Family accounts, phase 1: membership / allowlist.
--
-- The journal becomes multi-user (one row per family member). The practice book
-- stays owner-only. This single table is both the sign-in allowlist (keyed by
-- email, checked before a stable auth user_id exists) and the per-member
-- provisioning record (user_id filled in on first sign-in, seeded_at marks that
-- their journal has been seeded).
--
-- There is exactly one family, so there is no families table — "family-shared"
-- (phase 2) simply means visible to all members.

CREATE TABLE journal_members (
  email      text PRIMARY KEY,                                      -- lowercased; the allowlist key
  user_id    uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  is_owner   boolean NOT NULL DEFAULT false,                        -- owner gets the practice book + is the seed template
  seeded_at  timestamptz,                                           -- null until their journal is provisioned
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE journal_members ENABLE ROW LEVEL SECURITY;

-- Members may read their own row (e.g. to learn is_owner). All writes go through
-- the service-role provisioning path, never the user session.
CREATE POLICY "Read own membership" ON journal_members FOR SELECT
  USING (user_id = auth.uid());

-- Seed the owner. The owner's auth user already exists on any DB where they've
-- signed in; resolve by email so we never hardcode a uuid. seeded_at is stamped
-- now so provisioning never tries to re-seed (or overwrite) the owner.
DO $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT id INTO owner_id FROM auth.users WHERE email = 'andrew@mason.io';

  INSERT INTO journal_members (email, user_id, is_owner, seeded_at)
  VALUES ('andrew@mason.io', owner_id, true, CASE WHEN owner_id IS NULL THEN NULL ELSE now() END)
  ON CONFLICT (email) DO NOTHING;
END $$;
