-- Journal entries: a few closed historical entries with their conversations,
-- so /journal/history and the history detail view have content to show.
--
-- The journal is per-user (migration 00052), so every row needs an owner. Like
-- 00051/00052, we resolve the owner by email rather than hardcoding a uuid, and
-- skip cleanly when the owner's auth user doesn't exist yet — a fresh `supabase
-- db reset` wipes auth.users, and the NOT NULL user_id would otherwise abort the
-- whole seed. Re-running is safe: the three seed entries are deleted first and
-- journal_messages cascade off journal_entries.
DO $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT id INTO owner_id FROM auth.users WHERE email = 'andrew@mason.io';

  IF owner_id IS NULL THEN
    RAISE NOTICE 'No owner auth user; skipping journal demo entries. Sign in as andrew@mason.io, then re-run `supabase db reset` to seed them.';
    RETURN;
  END IF;

  DELETE FROM journal_entries WHERE id IN (
    'f0000001-0001-4001-8001-000000000001',
    'f0000001-0001-4001-8001-000000000002',
    'f0000001-0001-4001-8001-000000000003'
  );

  INSERT INTO journal_entries
    (id, user_id, entry_date, status, opening_question, summary, title, pull_quote, summary_stale, closed_at, created_at, updated_at) VALUES
    ('f0000001-0001-4001-8001-000000000001', owner_id, '2026-05-13', 'closed',
     'What is one small thing that felt steady this morning?',
     'A quiet morning with coffee and unhurried light set a calm tone for the day.',
     'Morning light',
     'I didn''t reach for my phone, and the quiet felt like a gift.',
     false,
     '2026-05-13 13:05:00+00', '2026-05-13 13:00:00+00', '2026-05-13 13:05:00+00'),
    ('f0000001-0001-4001-8001-000000000002', owner_id, '2026-05-14', 'closed',
     'Where did you meet resistance yesterday, and what did it ask of you?',
     'Wrestling with a single hard measure surfaced impatience, and naming it made room for slower practice.',
     'The hard measure',
     'The measure isn''t the problem - my hurry to be past it is.',
     false,
     '2026-05-14 13:06:00+00', '2026-05-14 13:00:00+00', '2026-05-14 13:06:00+00'),
    ('f0000001-0001-4001-8001-000000000003', owner_id, '2026-05-15', 'closed',
     'What surprised you about how you felt at the piano this week?',
     'A small breakthrough on the coda came from letting notes ring instead of forcing them.',
     'Letting it ring',
     'When I stopped pushing, the sound finally opened up.',
     false,
     '2026-05-15 13:05:00+00', '2026-05-15 13:00:00+00', '2026-05-15 13:05:00+00');

  INSERT INTO journal_messages (entry_id, user_id, role, content, created_at) VALUES
    ('f0000001-0001-4001-8001-000000000001', owner_id, 'assistant', 'What is one small thing that felt steady this morning?', '2026-05-13 13:00:00+00'),
    ('f0000001-0001-4001-8001-000000000001', owner_id, 'user', 'I made coffee and just sat with it for a few minutes before doing anything. I didn''t reach for my phone, and the quiet felt like a gift.', '2026-05-13 13:01:30+00'),
    ('f0000001-0001-4001-8001-000000000001', owner_id, 'assistant', 'That pause sounds deliberate. What made it possible to leave the phone alone today?', '2026-05-13 13:02:00+00'),
    ('f0000001-0001-4001-8001-000000000001', owner_id, 'user', 'I think I just didn''t want the day to start as a reaction to something. I wanted to choose it.', '2026-05-13 13:04:00+00'),

    ('f0000001-0001-4001-8001-000000000002', owner_id, 'assistant', 'Where did you meet resistance yesterday, and what did it ask of you?', '2026-05-14 13:00:00+00'),
    ('f0000001-0001-4001-8001-000000000002', owner_id, 'user', 'The same measure in the Ballade. I kept playing it over and over and getting more annoyed each time.', '2026-05-14 13:01:00+00'),
    ('f0000001-0001-4001-8001-000000000002', owner_id, 'assistant', 'What was the annoyance really about - the notes, or something else?', '2026-05-14 13:02:30+00'),
    ('f0000001-0001-4001-8001-000000000002', owner_id, 'user', 'Honestly it was impatience. The measure isn''t the problem - my hurry to be past it is.', '2026-05-14 13:04:30+00'),

    ('f0000001-0001-4001-8001-000000000003', owner_id, 'assistant', 'What surprised you about how you felt at the piano this week?', '2026-05-15 13:00:00+00'),
    ('f0000001-0001-4001-8001-000000000003', owner_id, 'user', 'The coda finally started to work, and not because I tried harder. I actually played it softer.', '2026-05-15 13:01:30+00'),
    ('f0000001-0001-4001-8001-000000000003', owner_id, 'assistant', 'Say more about that - what changed when you eased off?', '2026-05-15 13:02:30+00'),
    ('f0000001-0001-4001-8001-000000000003', owner_id, 'user', 'When I stopped pushing, the sound finally opened up. It felt like the piano was doing the work, not me.', '2026-05-15 13:04:30+00');

  -- Share one of the owner's entries to the family feed, so "me" also has a
  -- post the rest of the family can see (and comment on / be asked about).
  UPDATE journal_entries
  SET visibility = 'family'
  WHERE id = 'f0000001-0001-4001-8001-000000000003';
END $$;
