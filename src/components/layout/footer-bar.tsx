"use client";

import { PlayIcon, SquareIcon, MusicIcon, BookOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTimer } from "@/components/timer/timer-context";
import { useZenMode } from "@/components/layout/zen-mode-context";
import { formatElapsed } from "@/lib/timer-utils";
import type { TimerTarget } from "@/lib/types";
import { cn } from "@/lib/utils";

function targetKey(target: TimerTarget): string {
  return target.category === "piece" ? target.pieceId : target.category;
}

function targetsMatch(a: TimerTarget | null, b: TimerTarget): boolean {
  if (!a) return false;
  return targetKey(a) === targetKey(b);
}

export function FooterBar() {
  const isZenMode = useZenMode();
  const {
    isRunning,
    currentTarget,
    sessionElapsedSeconds,
    activePieces,
    startTimer,
    switchTarget,
    stopTimer,
  } = useTimer();

  const handlePillClick = (target: TimerTarget) => {
    if (targetsMatch(currentTarget, target)) return;
    if (isRunning) {
      switchTarget(target);
    } else {
      startTimer(target);
    }
  };

  const handleSelectChange = (value: string | null) => {
    if (!value) return;
    let target: TimerTarget;
    if (value === "technique") {
      target = { category: "technique" };
    } else if (value === "sight_reading") {
      target = { category: "sight_reading" };
    } else {
      const piece = activePieces.find((p) => p.id === value);
      if (!piece) return;
      target = {
        category: "piece",
        pieceId: piece.id,
        pieceName: piece.name,
        composer: piece.composer,
      };
    }
    handlePillClick(target);
  };

  const pieceTargets: TimerTarget[] = activePieces.map((p) => ({
    category: "piece",
    pieceId: p.id,
    pieceName: p.name,
    composer: p.composer,
  }));

  const specialTargets: TimerTarget[] = [
    { category: "technique" },
    { category: "sight_reading" },
  ];

  const allTargets = [...pieceTargets, ...specialTargets];

  const selectedValue = currentTarget ? targetKey(currentTarget) : undefined;

  if (isZenMode) return null;

  return (
    <footer className="sticky bottom-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* Play / Stop */}
        <Button
          variant={isRunning ? "destructive" : "default"}
          size="icon"
          className="size-9 shrink-0"
          onClick={isRunning ? stopTimer : undefined}
          disabled={!isRunning && activePieces.length === 0}
          aria-label={isRunning ? "Stop timer" : "Start timer"}
        >
          {isRunning ? (
            <SquareIcon className="size-4" />
          ) : (
            <PlayIcon className="size-4" />
          )}
        </Button>

        {/* Elapsed time */}
        <span
          className={cn(
            "shrink-0 tabular-nums text-sm font-medium min-w-[4ch]",
            isRunning ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {formatElapsed(sessionElapsedSeconds)}
        </span>

        {/* Desktop: pill buttons */}
        <div className="hidden md:flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none">
          {allTargets.map((target) => {
            const key = targetKey(target);
            const isActive = targetsMatch(currentTarget, target);
            const label =
              target.category === "piece"
                ? target.pieceName
                : target.category === "technique"
                  ? "Technique"
                  : "Sight Reading";

            return (
              <button
                key={key}
                onClick={() => handlePillClick(target)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {target.category === "piece" ? (
                  <MusicIcon className="size-3" />
                ) : (
                  <BookOpenIcon className="size-3" />
                )}
                {label}
              </button>
            );
          })}
        </div>

        {/* Mobile: select dropdown */}
        <div className="flex md:hidden flex-1 justify-end">
          <Select value={selectedValue} onValueChange={handleSelectChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select piece..." />
            </SelectTrigger>
            <SelectContent>
              {pieceTargets.map((target) => (
                <SelectItem key={target.category === "piece" ? target.pieceId : ""} value={target.category === "piece" ? target.pieceId : ""}>
                  {target.category === "piece" ? target.pieceName : ""}
                </SelectItem>
              ))}
              <SelectItem value="technique">Technique</SelectItem>
              <SelectItem value="sight_reading">Sight Reading</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </footer>
  );
}
