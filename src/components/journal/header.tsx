"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Plus, Settings } from "lucide-react";
import { ZenTimer } from "@/components/journal/zen-timer";

export function JournalHeader() {
  return (
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
  );
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
