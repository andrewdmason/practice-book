"use client";

import Link from "next/link";
import { AgentChatTrigger } from "@/components/journal/agent-chat-trigger";
import { ZenTimer } from "@/components/journal/zen-timer";

export function JournalHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
        <Link
          href="/journal"
          className="font-serif text-lg tracking-tight text-foreground"
        >
          journal
        </Link>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <ZenTimer />
        </div>
        <AgentChatTrigger />
      </div>
    </header>
  );
}
