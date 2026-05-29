-- Profile suggestions: passive, discriminating suggestions to update the User
-- profile doc, surfaced as a toast after an entry is wrapped.
--
-- Replaces the agent-chat thread (00036). The wrap pass now proposes at most
-- one change to the User file per entry; the user accepts (auto-applies) or
-- dismisses it via a toast. Dismissed suggestions are fed back to the wrap
-- prompt so they aren't re-raised.

CREATE TABLE journal_profile_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_entry_id uuid REFERENCES journal_entries(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  change_type text NOT NULL,
  find text,
  replace text,
  summary text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz,
  CONSTRAINT journal_profile_suggestions_status_check
    CHECK (status IN ('pending', 'accepted', 'dismissed')),
  CONSTRAINT journal_profile_suggestions_change_type_check
    CHECK (change_type IN ('add', 'edit', 'remove'))
);

CREATE INDEX idx_journal_profile_suggestions_status
  ON journal_profile_suggestions(status, created_at);

ALTER TABLE journal_profile_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON journal_profile_suggestions FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP TABLE IF EXISTS journal_agent_chat_messages;
