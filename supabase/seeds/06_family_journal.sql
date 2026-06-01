-- Family journal demo data: shared posts (plus one private) from Jenny, Oscar,
-- and Sebastian, with inline comments from across the family. This is what fills
-- the Family feed and gives the family-followup question type something to draw
-- on. The members' auth users + membership rows come from 00_dev_family.sql.
--
-- Each `family` entry is closed + visibility 'family' so it surfaces in the
-- Family feed; one private entry is included so the feed filtering is exercised.
-- Fixed entry uuids keep this idempotent. Skips cleanly if the members are absent
-- (e.g. a partial seed). Photos are attached separately by seed-journal-photos.mjs
-- (storage uploads can't run in a SQL seed).

DO $$
DECLARE
  andrew    uuid := (SELECT id FROM auth.users WHERE email = 'andrew@mason.io');
  jenny     uuid := (SELECT id FROM auth.users WHERE email = 'jenny@mason.io');
  oscar     uuid := (SELECT id FROM auth.users WHERE email = 'oscar@mason.io');
  sebastian uuid := (SELECT id FROM auth.users WHERE email = 'sebastian@mason.io');
BEGIN
  IF jenny IS NULL OR oscar IS NULL OR sebastian IS NULL THEN
    RAISE NOTICE 'Family members not found; skipping family journal seed.';
    RETURN;
  END IF;

  -- Idempotent: drop prior versions. Messages and inline comments cascade off the
  -- entry delete, so this clears all three.
  DELETE FROM journal_entries WHERE id IN (
    'a0000002-0001-4001-8001-000000000001',
    'a0000002-0001-4001-8001-000000000002',
    'a0000002-0002-4001-8001-000000000001',
    'a0000002-0003-4001-8001-000000000001'
  );

  INSERT INTO journal_entries
    (id, user_id, entry_date, status, entry_type, visibility, opening_question, summary, title, pull_quote, summary_stale, closed_at, created_at, updated_at) VALUES
    -- Jenny — the camping trip (shared)
    ('a0000002-0001-4001-8001-000000000001', jenny, '2026-05-25', 'closed', 'standard', 'family',
     'How was the camping trip this weekend?',
     'A weekend camping at Big Basin — cold mornings, a smoky dinner, and the kids finally sleeping through.',
     'the camping trip',
     'Sebastian gasped at the redwoods like they were a magic trick.',
     false, '2026-05-25 14:05:00+00', '2026-05-25 14:00:00+00', '2026-05-25 14:05:00+00'),
    -- Jenny — a quiet worry (private; should NOT appear in the family feed)
    ('a0000002-0001-4001-8001-000000000002', jenny, '2026-05-27', 'closed', 'standard', 'private',
     'What have you been chewing on that you haven''t told anyone?',
     'Turning over a work decision I haven''t said out loud yet.',
     'a quiet worry',
     'I keep circling it instead of just deciding.',
     false, '2026-05-27 14:05:00+00', '2026-05-27 14:00:00+00', '2026-05-27 14:05:00+00'),
    -- Oscar — the volcano won (shared)
    ('a0000002-0002-4001-8001-000000000001', oscar, '2026-05-26', 'closed', 'standard', 'family',
     'What was the best part of the science fair today?',
     'Oscar''s baking-soda volcano took first place at the school science fair.',
     'the volcano won',
     'It erupted way bigger than at home and everyone cheered.',
     false, '2026-05-26 14:05:00+00', '2026-05-26 14:00:00+00', '2026-05-26 14:05:00+00'),
    -- Sebastian — i scored a goal (shared)
    ('a0000002-0003-4001-8001-000000000001', sebastian, '2026-05-28', 'closed', 'standard', 'family',
     'Did anything exciting happen at soccer today?',
     'Sebastian scored his first goal of the soccer season.',
     'i scored a goal',
     'The ball went in and my whole team ran at me!',
     false, '2026-05-28 14:05:00+00', '2026-05-28 14:00:00+00', '2026-05-28 14:05:00+00');

  INSERT INTO journal_messages (entry_id, user_id, role, content, created_at) VALUES
    -- Jenny — the camping trip
    ('a0000002-0001-4001-8001-000000000001', jenny, 'assistant', 'How was the camping trip this weekend?', '2026-05-25 14:01:30+00'),
    ('a0000002-0001-4001-8001-000000000001', jenny, 'user', 'Honestly so good. The first morning was freezing and I questioned everything, but by the second day we''d all settled in. The kids were feral in the best way.', '2026-05-25 14:03:00+00'),
    ('a0000002-0001-4001-8001-000000000001', jenny, 'assistant', 'What''s the moment you''ll keep from it?', '2026-05-25 14:04:30+00'),
    ('a0000002-0001-4001-8001-000000000001', jenny, 'user', 'Sebastian gasped at the redwoods like they were a magic trick. I want to remember that face for a long time.', '2026-05-25 14:06:00+00'),
    -- Jenny — a quiet worry
    ('a0000002-0001-4001-8001-000000000002', jenny, 'assistant', 'What have you been chewing on that you haven''t told anyone?', '2026-05-27 14:01:30+00'),
    ('a0000002-0001-4001-8001-000000000002', jenny, 'user', 'Whether to take the new role. It''s more money but more travel, and I keep circling it instead of just deciding.', '2026-05-27 14:03:00+00'),
    -- Oscar — the volcano won
    ('a0000002-0002-4001-8001-000000000001', oscar, 'assistant', 'What was the best part of the science fair today?', '2026-05-26 14:01:30+00'),
    ('a0000002-0002-4001-8001-000000000001', oscar, 'user', 'MY VOLCANO WON. It erupted way bigger than at home and everyone cheered. Mr. Diaz said it was the loudest one.', '2026-05-26 14:03:00+00'),
    ('a0000002-0002-4001-8001-000000000001', oscar, 'assistant', 'What made it go so big this time?', '2026-05-26 14:04:30+00'),
    ('a0000002-0002-4001-8001-000000000001', oscar, 'user', 'I used warm water and WAY more vinegar. Science!', '2026-05-26 14:06:00+00'),
    -- Sebastian — i scored a goal
    ('a0000002-0003-4001-8001-000000000001', sebastian, 'assistant', 'Did anything exciting happen at soccer today?', '2026-05-28 14:01:30+00'),
    ('a0000002-0003-4001-8001-000000000001', sebastian, 'user', 'I SCORED!! The ball went in and my whole team ran at me. I almost fell over.', '2026-05-28 14:03:00+00'),
    ('a0000002-0003-4001-8001-000000000001', sebastian, 'assistant', 'How did it feel right when it went in?', '2026-05-28 14:04:30+00'),
    ('a0000002-0003-4001-8001-000000000001', sebastian, 'user', 'Like my tummy did a flip. The good kind.', '2026-05-28 14:06:00+00');

  -- Inline comments, anchored to a block_index (the message ordinal for these
  -- standard entries: 0 = opening question, 1 = first answer, 2 = next question,
  -- 3 = next answer). created_at order drives the byline's "with comments from …".
  INSERT INTO journal_inline_comments (entry_id, user_id, block_index, content, created_at, updated_at) VALUES
    ('a0000002-0001-4001-8001-000000000001', oscar,     1, 'I was NOT feral 😤', '2026-05-29 15:00:00+00', '2026-05-29 15:00:00+00'),
    ('a0000002-0001-4001-8001-000000000001', sebastian, 3, 'the trees were SO tall i couldn''t see the top', '2026-05-29 15:01:00+00', '2026-05-29 15:01:00+00'),
    ('a0000002-0001-4001-8001-000000000001', andrew,    3, 'I got the photo of that exact face. Framing it.', '2026-05-29 15:02:00+00', '2026-05-29 15:02:00+00'),
    ('a0000002-0002-4001-8001-000000000001', jenny,     1, 'We are SO proud of you, bud. 🌋', '2026-05-29 15:03:00+00', '2026-05-29 15:03:00+00'),
    ('a0000002-0002-4001-8001-000000000001', sebastian, 1, 'it was the loudest one!!!', '2026-05-29 15:04:00+00', '2026-05-29 15:04:00+00'),
    ('a0000002-0002-4001-8001-000000000001', jenny,     3, 'Future scientist over here.', '2026-05-29 15:05:00+00', '2026-05-29 15:05:00+00'),
    ('a0000002-0003-4001-8001-000000000001', jenny,     1, 'I cheered so loud I lost my voice. Worth it.', '2026-05-29 15:06:00+00', '2026-05-29 15:06:00+00'),
    ('a0000002-0003-4001-8001-000000000001', oscar,     3, 'haha the good kind. nice one seb', '2026-05-29 15:07:00+00', '2026-05-29 15:07:00+00');
END $$;
