"use client";

import { MessagesSquare } from "lucide-react";
import { useAgentChat } from "@/components/journal/agent-chat-context";
import { cn } from "@/lib/utils";

export function AgentChatTrigger() {
  const { toggle, unread, isOpen } = useAgentChat();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open agent chat"
      title="Talk to the agent"
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded transition-colors",
        isOpen
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <MessagesSquare className="h-5 w-5" />
      {unread && (
        <span
          aria-hidden
          className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary"
        />
      )}
    </button>
  );
}
