"use client";

import { useEffect } from "react";
import { useAgentChat } from "@/components/journal/agent-chat-context";

/**
 * Tells the agent chat sidebar which journal entry the user is currently
 * looking at, so the agent can include its transcript in context.
 */
export function JournalEntryScope({ id }: { id: string | null }) {
  const { setCurrentEntryId } = useAgentChat();
  useEffect(() => {
    setCurrentEntryId(id);
    return () => {
      setCurrentEntryId(null);
    };
  }, [id, setCurrentEntryId]);
  return null;
}
