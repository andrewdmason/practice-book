"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Piece, TimerTarget } from "@/lib/types";
import {
  startSession,
  switchEntry,
  stopSession,
  verifySession,
  closeAbandonedSession,
} from "@/app/(app)/timer/actions";

const STORAGE_KEY = "practice-timer-state";
const ABANDONED_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 hours

type PersistedState = {
  sessionId: string;
  currentEntryId: string;
  currentTarget: TimerTarget;
  sessionStartedAt: string;
  entryStartedAt: string;
};

type TimerContextValue = {
  isRunning: boolean;
  currentTarget: TimerTarget | null;
  focusedTarget: TimerTarget | null;
  setFocusedTarget: (target: TimerTarget | null) => void;
  sessionElapsedSeconds: number;
  entryElapsedSeconds: number;
  activePieces: Piece[];
  startTimer: (target: TimerTarget) => Promise<void>;
  switchTarget: (target: TimerTarget) => Promise<void>;
  stopTimer: () => Promise<void>;
};

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return ctx;
}

export function TimerProvider({
  activePieces,
  children,
}: {
  activePieces: Piece[];
  children: ReactNode;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [currentTarget, setCurrentTarget] = useState<TimerTarget | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [entryStartedAt, setEntryStartedAt] = useState<Date | null>(null);
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0);
  const [entryElapsedSeconds, setEntryElapsedSeconds] = useState(0);
  const [focusedTarget, setFocusedTarget] = useState<TimerTarget | null>(null);
  const [restored, setRestored] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = sessionId !== null;

  // Persist state to localStorage
  useEffect(() => {
    if (!restored) return;

    if (sessionId && currentEntryId && currentTarget && sessionStartedAt && entryStartedAt) {
      const state: PersistedState = {
        sessionId,
        currentEntryId,
        currentTarget,
        sessionStartedAt: sessionStartedAt.toISOString(),
        entryStartedAt: entryStartedAt.toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [sessionId, currentEntryId, currentTarget, sessionStartedAt, entryStartedAt, restored]);

  // Restore from localStorage on mount
  useEffect(() => {
    async function restore() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setRestored(true);
          return;
        }

        const state: PersistedState = JSON.parse(stored);
        const sessionAge = Date.now() - new Date(state.sessionStartedAt).getTime();

        // If session is too old, close it and clean up
        if (sessionAge > ABANDONED_THRESHOLD_MS) {
          localStorage.removeItem(STORAGE_KEY);
          await closeAbandonedSession(state.sessionId);
          setRestored(true);
          return;
        }

        // Verify session is still active in database
        const result = await verifySession(state.sessionId);
        if (!result.active) {
          localStorage.removeItem(STORAGE_KEY);
          setRestored(true);
          return;
        }

        // Restore state
        setSessionId(state.sessionId);
        setCurrentEntryId(state.currentEntryId);
        setCurrentTarget(state.currentTarget);
        setSessionStartedAt(new Date(state.sessionStartedAt));
        setEntryStartedAt(new Date(state.entryStartedAt));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
      setRestored(true);
    }

    restore();
  }, []);

  // Elapsed time interval
  useEffect(() => {
    if (isRunning && sessionStartedAt && entryStartedAt) {
      const tick = () => {
        const now = Date.now();
        setSessionElapsedSeconds(Math.floor((now - sessionStartedAt.getTime()) / 1000));
        setEntryElapsedSeconds(Math.floor((now - entryStartedAt.getTime()) / 1000));
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setSessionElapsedSeconds(0);
      setEntryElapsedSeconds(0);
    }
  }, [isRunning, sessionStartedAt, entryStartedAt]);

  const startTimer = useCallback(async (target: TimerTarget) => {
    const result = await startSession(target);
    if ("error" in result) {
      console.error("Failed to start session:", result.error);
      return;
    }
    const now = new Date(result.startedAt);
    setSessionId(result.sessionId);
    setCurrentEntryId(result.entryId);
    setCurrentTarget(target);
    setSessionStartedAt(now);
    setEntryStartedAt(now);
  }, []);

  const switchTargetFn = useCallback(
    async (target: TimerTarget) => {
      if (!sessionId || !currentEntryId) return;

      const result = await switchEntry(sessionId, currentEntryId, target);
      if ("error" in result) {
        console.error("Failed to switch entry:", result.error);
        return;
      }
      setCurrentEntryId(result.entryId);
      setCurrentTarget(target);
      setEntryStartedAt(new Date(result.switchedAt));
    },
    [sessionId, currentEntryId]
  );

  const stopTimerFn = useCallback(async () => {
    if (!sessionId || !currentEntryId) return;

    const result = await stopSession(sessionId, currentEntryId);
    if ("error" in result) {
      console.error("Failed to stop session:", result.error);
      return;
    }
    setFocusedTarget(currentTarget);
    setSessionId(null);
    setCurrentEntryId(null);
    setCurrentTarget(null);
    setSessionStartedAt(null);
    setEntryStartedAt(null);
  }, [sessionId, currentEntryId, currentTarget]);

  return (
    <TimerContext.Provider
      value={{
        isRunning,
        currentTarget,
        focusedTarget,
        setFocusedTarget,
        sessionElapsedSeconds,
        entryElapsedSeconds,
        activePieces,
        startTimer,
        switchTarget: switchTargetFn,
        stopTimer: stopTimerFn,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}
