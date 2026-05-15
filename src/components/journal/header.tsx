"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AgentChatTrigger } from "@/components/journal/agent-chat-trigger";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "today", href: "/journal" },
  { label: "history", href: "/journal/history" },
  { label: "agent", href: "/journal/agent" },
];

export function JournalHeader() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/journal") return pathname === "/journal";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
        <Link
          href="/journal"
          className="font-serif text-lg tracking-tight text-foreground"
        >
          journal
        </Link>
        <nav className="flex items-center gap-5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "font-serif text-sm transition-colors hover:text-foreground",
                isActive(item.href) ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
          <AgentChatTrigger />
        </nav>
      </div>
    </header>
  );
}
