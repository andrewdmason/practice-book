"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Menu, ClockIcon, PauseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MetronomeControl } from "@/components/metronome/metronome-control";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { formatElapsed } from "@/lib/timer-utils";
import {
  createTask,
  getNextTaskForToday,
} from "@/app/(app)/timer/task-actions";
import { localDate } from "@/lib/date-utils";
import { emitOptimisticTask, rollbackOptimisticTask } from "@/lib/optimistic-task";
import type { Piece } from "@/lib/types";

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
  const {
    dailyElapsedSeconds,
    activeTaskId,
    startTaskTimer,
    pauseTaskTimer,
    focusedPieceId,
    activePieces,
  } = useTaskTimer();
  const isTimerActive = activeTaskId !== null;
  const [piecePickerOpen, setPiecePickerOpen] = useState(false);
  const recordButtonRef = useRef<HTMLButtonElement>(null);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const startTimerForPiece = async (piece: Piece) => {
    const existing = await getNextTaskForToday(piece.id);
    if (existing) {
      startTaskTimer(existing.id, existing.timer_remaining_seconds);
      return;
    }
    // No task for today under this piece — create one and start its timer.
    const today = localDate();
    const tempId = emitOptimisticTask({
      pieceId: piece.id,
      sectionId: null,
      date: today,
      metronomeSpeed: null,
      pieceName: piece.name,
      pieceComposer: piece.composer,
      pieceKind: piece.kind,
      sectionLabel: null,
      sectionStatus: null,
    });
    try {
      const { id, timer_remaining_seconds } = await createTask(
        piece.id,
        null,
        null,
        today
      );
      startTaskTimer(id, timer_remaining_seconds);
    } catch (err) {
      rollbackOptimisticTask(tempId);
      throw err;
    }
  };

  const handleTimerClick = async () => {
    if (isTimerActive) {
      pauseTaskTimer();
      return;
    }
    if (focusedPieceId) {
      const piece = activePieces.find((p) => p.id === focusedPieceId);
      if (piece) {
        await startTimerForPiece(piece);
        return;
      }
    }
    setPiecePickerOpen(true);
  };

  const handlePickPiece = async (piece: Piece) => {
    setPiecePickerOpen(false);
    await startTimerForPiece(piece);
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
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
            ref={recordButtonRef}
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
                : "Start practice timer"
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
          <Popover open={piecePickerOpen} onOpenChange={setPiecePickerOpen}>
            <PopoverContent
              anchor={recordButtonRef}
              align="end"
              side="bottom"
              sideOffset={6}
              className="w-56 p-1 gap-0"
            >
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                What are you practicing?
              </div>
              <ul className="flex max-h-72 flex-col overflow-auto">
                {activePieces.map((piece) => (
                  <li key={piece.id}>
                    <button
                      type="button"
                      onClick={() => handlePickPiece(piece)}
                      className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-left hover:bg-muted"
                    >
                      {piece.name}
                    </button>
                  </li>
                ))}
                {activePieces.length === 0 && (
                  <li className="px-2 py-1.5 text-xs text-muted-foreground">
                    No active pieces.
                  </li>
                )}
              </ul>
            </PopoverContent>
          </Popover>

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
