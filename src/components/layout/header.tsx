"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ClockIcon, PauseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MetronomeControl } from "@/components/metronome/metronome-control";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { formatElapsed } from "@/lib/timer-utils";
import { getNextTaskForToday } from "@/app/(app)/timer/task-actions";

const navItems = [
  { label: "Practice Log", href: "/" },
  { label: "Lessons", href: "/lessons" },
  { label: "Repertoire", href: "/repertoire" },
  { label: "Reports", href: "/reports" },
];

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "text-sm font-medium transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {label}
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const { dailyElapsedSeconds, activeTaskId, startTaskTimer, pauseTaskTimer } =
    useTaskTimer();
  const isTimerActive = activeTaskId !== null;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const handleTimerClick = async () => {
    if (isTimerActive) {
      pauseTaskTimer();
      return;
    }
    const task = await getNextTaskForToday();
    if (!task) return;
    startTaskTimer(task.id, task.timer_remaining_seconds);
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
        <Link href="/" className="mr-8">
          <h1 className="text-lg font-semibold tracking-tight">
            Practice Book
          </h1>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={isActive(item.href)}
            />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Daily aggregate timer — click to start/stop practice */}
          <button
            onClick={handleTimerClick}
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              isTimerActive
                ? "rounded-full bg-red-500 px-2.5 py-1 text-white hover:bg-red-600"
                : "rounded px-1.5 py-1 text-muted-foreground hover:bg-muted"
            )}
            aria-label={
              isTimerActive
                ? "Stop practice timer"
                : "Start practice timer on next task"
            }
          >
            {isTimerActive ? (
              <PauseIcon className="size-4 fill-current" />
            ) : (
              <ClockIcon className="size-4" />
            )}
            <span className="tabular-nums text-sm font-medium min-w-[4ch]">
              {formatElapsed(dailyElapsedSeconds)}
            </span>
          </button>

          {/* Metronome */}
          <MetronomeControl />

          {/* Mobile nav */}
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden" />
              }
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetTitle className="font-semibold">Navigation</SheetTitle>
              <nav className="mt-6 flex flex-col gap-4">
                {navItems.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={isActive(item.href)}
                  />
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
