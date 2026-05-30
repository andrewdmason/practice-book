"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Flame, Pencil, Plus, Settings, Star, Trophy } from "lucide-react";
import { ZenTimer } from "@/components/journal/zen-timer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { JournalStreakStats } from "@/components/journal/header";

export function JournalHeaderClient({
  streak,
}: {
  streak: JournalStreakStats;
}) {
  return (
    <TooltipProvider>
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="relative mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Suspense fallback={<HeaderNav fallback me />}>
              <HeaderNav />
            </Suspense>
            <Link
              href="/journal/new"
              aria-label="New entry"
              title="New entry"
              className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-5 w-5" />
            </Link>
            <JournalStreakBadge streak={streak} />
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <ZenTimer />
          </div>
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>
    </TooltipProvider>
  );
}

function JournalStreakBadge({ streak }: { streak: JournalStreakStats }) {
  const { icon: Icon, className } = getStreakIcon(streak.currentStreak);
  const message = getStreakMessage(streak);

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`${streak.currentStreak} day posting streak`}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full bg-muted/70 px-2.5 text-sm font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          streak.currentStreak > 0 && "text-foreground"
        )}
      >
        <Icon className={cn("h-4 w-4", className)} />
        <span>{streak.currentStreak}</span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="block max-w-64 rounded-lg px-4 py-3 text-left"
      >
        <p className="font-medium">
          {streak.currentStreak} day
          {streak.currentStreak === 1 ? "" : "s"} in a row
        </p>
        <p className="mt-1 text-background/75">
          {streak.daysThisWeek}/7 days this week
        </p>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {streak.thisWeekDays.map((posted, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                posted ? "bg-background" : "bg-background/30"
              )}
            />
          ))}
        </div>
        <p className="mt-3 text-background/85">{message}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function getStreakIcon(streak: number) {
  if (streak >= 14) {
    return { icon: Trophy, className: "text-primary" };
  }
  if (streak >= 7) {
    return { icon: Star, className: "fill-primary text-primary" };
  }
  if (streak > 0) {
    return { icon: Flame, className: "fill-primary text-primary" };
  }
  return { icon: Pencil, className: "text-muted-foreground" };
}

function getStreakMessage(streak: JournalStreakStats): string {
  if (streak.currentStreak === 0) {
    return "Start with one small memory today.";
  }
  if (!streak.postedToday) {
    return "Post today to keep the streak alive.";
  }
  if (streak.currentStreak >= 14) {
    return "This is a real run. Future you has a lot to read.";
  }
  if (streak.currentStreak >= 7) {
    return "A full-week habit is forming. Keep the chain alive.";
  }
  return "You are building a rhythm. A few words still count.";
}

// The primary journal feed nav. "Me" is the caller's own feed (and the
// wordmark's replacement); "Family" the shared feed. The `me`/`family` props are
// only used by the Suspense fallback (which can't read search params); the live
// render derives them from the URL.
function HeaderNav({
  me,
  family,
  fallback = false,
}: {
  me?: boolean;
  family?: boolean;
  fallback?: boolean;
} = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  let isMe = me ?? false;
  let isFamily = family ?? false;
  if (!fallback) {
    const onJournal = pathname === "/journal";
    isFamily = onJournal && searchParams.get("feed") === "family";
    isMe = onJournal && !isFamily;
  }

  return (
    <nav className="flex items-baseline gap-5 font-serif text-lg tracking-tight">
      <HeaderLink href="/journal" active={isMe}>
        Me
      </HeaderLink>
      <HeaderLink href="/journal?feed=family" active={isFamily}>
        Family
      </HeaderLink>
    </nav>
  );
}

function HeaderLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "text-foreground underline underline-offset-4 decoration-foreground/30"
          : "text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}
