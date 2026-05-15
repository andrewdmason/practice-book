"use client";

import { useEffect, useState } from "react";
import {
  TIMER_DONE_COLOR,
  useJournalTimer,
} from "@/components/journal/timer-context";

/**
 * An ambient radial timer. It fills like a pie over five minutes — no numbers
 * shown. At completion the fill settles into a muted green, so writing past
 * the minimum is quietly marked as complete. Driven by JournalTimerProvider so
 * it can sit in the centered header and stay visible while the conversation is
 * scrolled.
 */
export function ZenTimer() {
  const { running, done, degrees } = useJournalTimer();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [running]);

  if (!running) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none flex justify-center transition-opacity duration-1000 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="h-[18px] w-[18px] rounded-full shadow-[0_0_0_1px_var(--muted)]"
        style={{
          background: `conic-gradient(${
            done ? TIMER_DONE_COLOR : "oklch(0.68 0.02 50)"
          } ${degrees}deg, var(--muted) 0deg)`,
        }}
      />
    </div>
  );
}
