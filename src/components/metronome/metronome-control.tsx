"use client";

import { useRef, useEffect } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
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
  const pulseRef = useRef<HTMLSpanElement>(null);

  // Trigger pulse animation on each beat
  useEffect(() => {
    if (!isActive || beatPulse === 0) return;
    const el = pulseRef.current;
    if (!el) return;
    el.classList.remove("animate-beat-pulse");
    // Force reflow to restart animation
    void el.offsetWidth;
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
            ? "text-foreground hover:bg-muted"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        aria-label={isActive ? "Stop metronome" : "Start metronome"}
      >
        <span
          ref={pulseRef}
          className={cn(
            "block size-2.5 rounded-full transition-colors",
            isActive ? "bg-primary" : "bg-muted-foreground/50"
          )}
        />
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
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
