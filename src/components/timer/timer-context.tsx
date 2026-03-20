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
const OPTIMISTIC_ID = "__optimistic__";

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
  startTimer: (target: TimerTarget) => void;
  switchTarget: (target: TimerTarget) => void;
  stopTimer: () => void;
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

  // Chain of server operations to ensure ordering
  const operationChain = useRef<Promise<void>>(Promise.resolve());
  // Latest confirmed server IDs (updated after each server response)
  const confirmedIds = useRef<{ sessionId: string; entryId: string } | null>(null);

  const isRunning = sessionId !== null;

  // Persist state to localStorage (skip optimistic placeholder IDs)
  useEffect(() => {
    if (!restored) return;

    if (
      sessionId && sessionId !== OPTIMISTIC_ID &&
      currentEntryId && currentEntryId !== OPTIMISTIC_ID &&
      currentTarget && sessionStartedAt && entryStartedAt
    ) {
      const state: PersistedState = {
        sessionId,
        currentEntryId,
        currentTarget,
        sessionStartedAt: sessionStartedAt.toISOString(),
        entryStartedAt: entryStartedAt.toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else if (!sessionId) {
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
        confirmedIds.current = { sessionId: state.sessionId, entryId: state.currentEntryId };
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

  const startTimer = useCallback((target: TimerTarget) => {
    const now = new Date();

    // Optimistic: update UI immediately
    setSessionId(OPTIMISTIC_ID);
    setCurrentEntryId(OPTIMISTIC_ID);
    setCurrentTarget(target);
    setSessionStartedAt(now);
    setEntryStartedAt(now);

    // Chain the server call
    operationChain.current = operationChain.current.then(async () => {
      const result = await startSession(target);
      if ("error" in result) {
        console.error("Failed to start session:", result.error);
        confirmedIds.current = null;
        setSessionId(null);
        setCurrentEntryId(null);
        setCurrentTarget(null);
        setSessionStartedAt(null);
        setEntryStartedAt(null);
        return;
      }
      confirmedIds.current = { sessionId: result.sessionId, entryId: result.entryId };
      setSessionId(result.sessionId);
      setCurrentEntryId(result.entryId);
    });
  }, []);

  const switchTargetFn = useCallback(
    (target: TimerTarget) => {
      const now = new Date();

      // Optimistic: update UI immediately
      setCurrentTarget(target);
      setEntryStartedAt(now);
      setCurrentEntryId(OPTIMISTIC_ID);

      // Chain the server call (waits for any pending start/switch)
      operationChain.current = operationChain.current.then(async () => {
        const ids = confirmedIds.current;
        if (!ids) return;

        const result = await switchEntry(ids.sessionId, ids.entryId, target);
        if ("error" in result) {
          console.error("Failed to switch entry:", result.error);
          return;
        }
        confirmedIds.current = { sessionId: ids.sessionId, entryId: result.entryId };
        setCurrentEntryId(result.entryId);
      });
    },
    []
  );

  const stopTimerFn = useCallback(() => {
    // Capture target before clearing for focusedTarget
    const targetToFocus = currentTarget;

    // Optimistic: clear UI immediately
    setFocusedTarget(targetToFocus);
    setSessionId(null);
    setCurrentEntryId(null);
    setCurrentTarget(null);
    setSessionStartedAt(null);
    setEntryStartedAt(null);

    // Chain the server call (waits for any pending start/switch)
    operationChain.current = operationChain.current.then(async () => {
      const ids = confirmedIds.current;
      confirmedIds.current = null;
      if (!ids) return;

      const result = await stopSession(ids.sessionId, ids.entryId);
      if ("error" in result) {
        console.error("Failed to stop session:", result.error);
      }
    });
  }, [currentTarget]);

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
