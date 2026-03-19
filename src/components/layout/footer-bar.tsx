"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PlayIcon, SquareIcon, MusicIcon, BookOpenIcon, XIcon } from "lucide-react";
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
import { MetronomeControl } from "@/components/metronome/metronome-control";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusParam = searchParams.get("focus");

  const {
    isRunning,
    currentTarget,
    focusedTarget,
    setFocusedTarget,
    sessionElapsedSeconds,
    activePieces,
    startTimer,
    switchTarget,
    stopTimer,
  } = useTimer();

  // The visually active target: current (when running) or focused (when stopped)
  const activeTarget = isRunning ? currentTarget : focusedTarget;

  // Sync URL focus param → focusedTarget on mount and param changes (only on home page)
  useEffect(() => {
    if (pathname !== "/" || isRunning) return;
    if (!focusParam) {
      if (focusedTarget) setFocusedTarget(null);
      return;
    }
    // Check if focusParam matches the current focusedTarget already
    if (focusedTarget && targetKey(focusedTarget) === focusParam) return;

    if (focusParam === "technique") {
      setFocusedTarget({ category: "technique" });
    } else if (focusParam === "sight_reading") {
      setFocusedTarget({ category: "sight_reading" });
    } else {
      const piece = activePieces.find((p) => p.id === focusParam);
      if (piece) {
        setFocusedTarget({
          category: "piece",
          pieceId: piece.id,
          pieceName: piece.name,
          composer: piece.composer,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam, pathname]);

  const setFocusUrl = useCallback(
    (key: string | null) => {
      const typeParam = searchParams.get("type");
      const buildUrl = (focusKey: string | null) => {
        const params = new URLSearchParams();
        if (focusKey) params.set("focus", focusKey);
        if (typeParam) params.set("type", typeParam);
        const qs = params.toString();
        return qs ? `/?${qs}` : "/";
      };

      if (pathname !== "/") {
        router.push(buildUrl(key));
        return;
      }
      router.replace(buildUrl(key), { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handlePillClick = (target: TimerTarget) => {
    const key = targetKey(target);
    if (isRunning) {
      if (!targetsMatch(activeTarget, target)) {
        switchTarget(target);
      }
      return;
    }
    // If already focused on this target, deselect
    if (targetsMatch(focusedTarget, target)) {
      setFocusedTarget(null);
      setFocusUrl(null);
      return;
    }
    setFocusedTarget(target);
    setFocusUrl(key);
  };

  const clearFocus = useCallback(() => {
    if (!isRunning) {
      setFocusedTarget(null);
      setFocusUrl(null);
    }
  }, [isRunning, setFocusedTarget, setFocusUrl]);

  // Escape key clears focus
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && focusedTarget && !isRunning) {
        clearFocus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedTarget, isRunning, clearFocus]);

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

  const allTargets = [...specialTargets, ...pieceTargets];

  const handlePlayClick = () => {
    const target = focusedTarget ?? allTargets[0];
    if (target) {
      startTimer(target);
      setFocusedTarget(null);
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

  const selectedValue = activeTarget ? targetKey(activeTarget) : undefined;
  const showClear = !isRunning && focusedTarget !== null;

  if (isZenMode) return null;
  if (pathname !== "/" && !isRunning) return null;

  return (
    <div className="sticky top-14 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* Play / Stop */}
        <Button
          variant={isRunning ? "destructive" : "default"}
          size="icon"
          className="size-9 shrink-0"
          onClick={isRunning ? stopTimer : handlePlayClick}
          disabled={!isRunning && allTargets.length === 0}
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
            const isActive = targetsMatch(activeTarget, target);
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

        {/* Metronome control - right aligned */}
        <div className="hidden md:flex ml-auto shrink-0">
          <MetronomeControl />
        </div>

        {/* Clear focus button */}
        {showClear && (
          <button
            onClick={clearFocus}
            className="hidden md:inline-flex items-center justify-center size-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Clear selection"
          >
            <XIcon className="size-3.5" />
          </button>
        )}

        {/* Mobile: select dropdown + metronome */}
        <div className="flex md:hidden flex-1 items-center justify-end gap-2">
          <Select value={selectedValue ?? ""} onValueChange={handleSelectChange}>
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
          <MetronomeControl />
        </div>
      </div>
    </div>
  );
}
