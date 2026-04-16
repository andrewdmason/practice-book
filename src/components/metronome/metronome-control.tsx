"use client";

import { useRef, useEffect, useCallback } from "react";
import { MinusIcon, PlusIcon, MetronomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMetronome } from "@/components/metronome/metronome-context";
import { cn } from "@/lib/utils";

export function MetronomeControl() {
  const { bpm, setBpm, isActive, toggle, beatPulse } = useMetronome();
  const pulseRef = useRef<SVGSVGElement>(null);

  // Tap tempo state
  const tapTimesRef = useRef<number[]>([]);
  const tapResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback(() => {
    const now = performance.now();
    const taps = tapTimesRef.current;

    // Reset if last tap was more than 2 seconds ago
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) {
      taps.length = 0;
    }

    taps.push(now);

    // Keep last 8 taps
    if (taps.length > 8) taps.shift();

    // Need at least 2 taps to calculate
    if (taps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1]);
      }
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgMs);
      setBpm(Math.max(20, Math.min(300, calculatedBpm)));
    }

    // Auto-reset after 2 seconds of no tapping
    if (tapResetRef.current) clearTimeout(tapResetRef.current);
    tapResetRef.current = setTimeout(() => {
      tapTimesRef.current = [];
    }, 2000);
  }, [setBpm]);

  // Trigger pulse animation on each beat
  useEffect(() => {
    if (!isActive || beatPulse === 0) return;
    const el = pulseRef.current;
    if (!el) return;
    el.classList.remove("animate-beat-pulse");
    // Force reflow to restart animation
    void el.getBoundingClientRect();
    el.classList.add("animate-beat-pulse");
  }, [beatPulse, isActive]);

  return (
    <div className="flex items-center gap-1">
      {/* Beat indicator / toggle button */}
      <button
        onClick={toggle}
        className={cn(
          "flex size-7 items-center justify-center rounded-full transition-colors",
          isActive
            ? "text-primary hover:bg-muted"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        aria-label={isActive ? "Stop metronome" : "Start metronome"}
      >
        <MetronomeIcon ref={pulseRef} className="size-4" />
      </button>

      {/* BPM display + popover */}
      <Popover>
        <PopoverTrigger
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-sm tabular-nums transition-colors hover:bg-muted",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {bpm}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="end" sideOffset={8}>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setBpm(bpm - 1)}
              disabled={bpm <= 20}
              aria-label="Decrease BPM"
            >
              <MinusIcon className="size-3" />
            </Button>
            <input
              type="number"
              min={20}
              max={300}
              value={bpm}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) setBpm(val);
              }}
              className="w-14 rounded border bg-background px-2 py-1 text-center font-mono text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setBpm(bpm + 1)}
              disabled={bpm >= 300}
              aria-label="Increase BPM"
            >
              <PlusIcon className="size-3" />
            </Button>
            <Button
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={handleTap}
              aria-label="Tap tempo"
            >
              Tap
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
