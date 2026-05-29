-- Structured question types + per-day settings for the journal interviewer.
--
-- Replaces the old approach where the daily question mix lived as free text in
-- the Interviewer file and was reverse-engineered each morning by a small LLM.
-- Now the user authors question types directly (relative weight + optional
-- free-text style note), tunes how many questions are proposed per day, and the
-- Interviewer file goes back to being purely about voice. Also renames the
-- "Me" agent file to "User".

-- ============================================================
-- Question types
-- ============================================================

CREATE TABLE journal_question_types (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text UNIQUE NOT NULL,        -- kebab-case identifier
  base_description text NOT NULL,               -- locked core meaning
  style_note       text NOT NULL DEFAULT '',    -- user's free-text append
  weight           numeric NOT NULL DEFAULT 0,  -- relative frequency
  enabled          boolean NOT NULL DEFAULT true,
  is_builtin       boolean NOT NULL DEFAULT false,
  sort_order       int NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_journal_question_types_sort ON journal_question_types(sort_order);

CREATE TRIGGER journal_question_types_updated_at
  BEFORE UPDATE ON journal_question_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE journal_question_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON journal_question_types FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 13 built-in types, all enabled. Weights are RELATIVE (the sampler normalizes
-- them) and map to the UI's cadence tiers: 12 = Daily, 6 = Several times a week,
-- 3 = Once a week, 1 = Less than once a week. Descriptions are voice-neutral —
-- the interviewer's voice lives only in the Interviewer file.
INSERT INTO journal_question_types (name, base_description, weight, is_builtin, sort_order) VALUES
('recent-calendar',     $$Pulls a specific event from your connected calendar in the last few days and asks about it — best once it has already happened.$$,                  12, true, 1),
('upcoming-calendar',   $$Looks ahead on your calendar and asks about something coming up. Used sparingly.$$,                                                                3, true, 2),
('historical-followup', $$Re-reads your recent journal entries and picks up a specific thread you wrote about, referencing it directly.$$,                                   6, true, 3),
('me-topic',            $$Draws on your User file — projects, interests, people — and asks about one, rotating so it doesn't fixate on the same thing.$$,                     6, true, 4),
('deep-introspective',  $$An open, reflective prompt aimed at something unspoken or unresolved. Not tied to any event — high risk, high reward.$$,                           6, true, 5),
('gratitude',           $$A simple prompt to name something you're grateful for right now. Not drawn from any particular source.$$,                                          3, true, 6),
('mood-check-in',       $$A concrete read on how you're feeling today. General, not tied to a specific event.$$,                                                             3, true, 7),
('daily-recap',         $$Asks about a small, concrete moment from today or yesterday, leaning on the time of day and your calendar rather than past entries.$$,              6, true, 8),
('intentions',          $$A forward-looking prompt about what you want from today or the week ahead, with a light read on what's on your calendar.$$,                         3, true, 9),
('unresolved-loop',     $$Scans your recent entries for an open worry or tension you mentioned but didn't resolve, and checks back on it.$$,                                  3, true, 10),
('relationship',        $$Surfaces a specific person from your User file or recent entries and asks about a recent moment with them.$$,                                       3, true, 11),
('curveball',           $$A deliberately unexpected, playful prompt from an angle you wouldn't predict. Not based on your data.$$,                                            1, true, 12),
('sensory-moment',      $$Asks you to capture a sensory detail — something you saw, heard, tasted, or felt recently. Not tied to a specific source.$$,                        3, true, 13);

-- ============================================================
-- Settings (single row)
-- ============================================================

CREATE TABLE journal_settings (
  id                int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  questions_per_day int NOT NULL DEFAULT 3 CHECK (questions_per_day BETWEEN 1 AND 5),
  updated_at        timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER journal_settings_updated_at
  BEFORE UPDATE ON journal_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE journal_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON journal_settings FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

INSERT INTO journal_settings (id) VALUES (1);

-- ============================================================
-- Rename the "Me" agent file to "User"
-- ============================================================

UPDATE journal_agent_files SET name = 'User' WHERE name = 'Me';
