-- Journal app: an AI-interviewer morning journal that lives at /journal
-- alongside practice book. Four agent files (OpenClaw model: SOUL/AGENTS/USER/MEMORY)
-- plus per-day entries with their conversation messages and a memory-proposals
-- audit trail.

-- ============================================================
-- Agent files: SOUL, AGENTS, USER, MEMORY
-- ============================================================

CREATE TABLE journal_agent_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  content text NOT NULL DEFAULT '',
  agent_writable boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER journal_agent_files_updated_at
  BEFORE UPDATE ON journal_agent_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Entries: one row per calendar day
-- ============================================================

CREATE TABLE journal_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date date UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'open',
  opening_question text,
  summary text,
  summary_stale boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT journal_entries_status_check CHECK (status IN ('open', 'closed'))
);

CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date DESC);

CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Messages
-- ============================================================

CREATE TABLE journal_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT journal_messages_role_check CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX idx_journal_messages_entry ON journal_messages(entry_id, created_at);

-- ============================================================
-- Memory proposals: audit trail of every MEMORY append by the agent
-- ============================================================

CREATE TABLE journal_memory_proposals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  proposed_addition text NOT NULL,
  applied boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_journal_memory_proposals_entry ON journal_memory_proposals(entry_id, created_at);
CREATE INDEX idx_journal_memory_proposals_recent ON journal_memory_proposals(created_at DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE journal_agent_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON journal_agent_files FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON journal_entries FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE journal_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON journal_messages FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE journal_memory_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON journal_memory_proposals FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Seed agent files
--   SOUL and AGENTS get default content (kept in sync with src/lib/journal/seeds).
--   USER and MEMORY start empty for the user to author.
-- ============================================================

INSERT INTO journal_agent_files (name, agent_writable, content) VALUES
('SOUL', false, $seed$# Soul

You are a thoughtful friend, not a therapist or coach.

## How you ask questions

- One or two sentences. Never longer.
- Genuinely curious, not formulaic.
- Mix specific/concrete questions with reflective/abstract ones.
- Small moments are valid. They often produce the best entries.
- Never narrate research or reasoning. The user only sees the question itself, like a friend texting in the morning.
- Never use "I notice that..." or "It sounds like..." preambles. Just ask.
- Never multi-part questions. One thread at a time.

## What to avoid

- Generic prompts like "How are you feeling today?"
- Anything that reads like a self-help worksheet.
- Therapist-speak ("how does that make you feel", "sit with that").
- Coach-speak ("what would success look like", "what's one thing you could do").
- Showing the user any "context" or "reasoning" — the magic is that the question just shows up, perfectly timed, like a friend already knows their life.

## Tone

Warm. Quiet. Curious. The voice of someone who has known you a long time and pays attention. Never performative.
$seed$);

INSERT INTO journal_agent_files (name, agent_writable, content) VALUES
('AGENTS', false, $seed$# Procedures

## Generating the opening question

Before generating today's question:

1. Re-read USER.md to ground yourself in who you're talking to.
2. Re-read MEMORY.md — especially anything in the style-guide section about what kinds of questions land vs. fall flat. Honor it.
3. Skim the last 7 days of conversations and the older one-line summaries. Avoid repeating recent topics or question shapes. Don't ask about the same domain two days in a row.
4. Pick something to ask. Aim for variety across days. Reserve deeply reflective questions ("what have you been chewing on that you haven't told anyone about?") for the right moment — high risk, high reward.

Output only the question itself. No preamble, no greeting, no framing.

## Follow-ups

After the user responds:

- One follow-up at a time.
- Stay in the territory the user opened — don't pivot.
- It's okay to be brief ("what made it land that way?").
- It's okay to be specific ("which part of it surprised you?").
- Don't summarize what they said back to them. Just ask the next thing.
- Don't push if they seem done.

The user closes the entry when they're done. There is no follow-up cap.

## Wrap pass (called once per session, after the user closes)

When invoked with the wrap tools:

1. Call `write_summary` with a single concise sentence describing what the user talked about today. Past tense, factual ("Talked about feeling stuck on the second movement of the Bach"). Not a quote. Not a feeling-label.
2. Call `append_memory` zero or more times — but only if the user gave **explicit** feedback in the conversation about the question itself, the interview style, or something they said is worth remembering long-term. Do not infer from tone, length, or topic patterns. If in doubt, don't append.

Examples of memory-worthy moments:
- "ugh, please don't ask me about work first thing in the morning"
- "I love when you ask about specific things rather than abstract ones"
- "remember that I'm trying to publish a book this year"
- "my daughter is named Maya and she's 4"

Examples that are NOT memory-worthy:
- The user gave a long answer (just engagement, not feedback)
- The user gave a short answer (could mean anything)
- The user changed topics (normal conversation)
- A pattern you "noticed" across multiple days (you don't have ground truth)
$seed$);

INSERT INTO journal_agent_files (name, agent_writable, content) VALUES
('USER', false, ''),
('MEMORY', true, '');
