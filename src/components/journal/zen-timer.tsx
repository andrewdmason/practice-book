"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 5 * 60 * 1000;

/**
 * An ambient radial timer centered above the journal's opening question.
 * It starts once the question has generated and fills like a pie over five
 * minutes — no numbers shown. At completion the fill shifts from grey to
 * warm and settles into a slow breath, so writing past the minimum is
 * rewarded rather than nagged.
 */
export function ZenTimer({ running }: { running: boolean }) {
  const [degrees, setDegrees] = useState(0);
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const showTimeout = setTimeout(() => setVisible(true), 50);
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / DURATION_MS, 1);
      const deg = p * 360;
      // Re-render only when the visible whole-degree changes.
      setDegrees((prev) => (Math.floor(deg) !== Math.floor(prev) ? deg : prev));
      if (p >= 1) {
        setDone(true);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      clearTimeout(showTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
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
        className={`h-[18px] w-[18px] rounded-full shadow-[0_0_0_1px_var(--muted)] ${
          done ? "animate-[zen-timer-breath_5s_ease-in-out_infinite]" : ""
        }`}
        style={{
          background: `conic-gradient(${
            done ? "var(--primary)" : "oklch(0.68 0.02 50)"
          } ${degrees}deg, var(--muted) 0deg)`,
        }}
      />
    </div>
  );
}
