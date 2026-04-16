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
import {
  updateTaskRemaining,
  startTaskTimer as startTaskTimerAction,
  stopTaskTimer as stopTaskTimerAction,
} from "@/app/(app)/timer/task-actions";
import type { Piece } from "@/lib/types";

const STORAGE_KEY = "practice-task-timer-state";

type PersistedState = {
  taskId: string;
  remainingSeconds: number;
  lastTickAt: string;
};

type TaskTimerContextValue = {
  activeTaskId: string | null;
  remainingSeconds: number;
  isExpired: boolean;
  /** Total elapsed seconds for tasks today (from server data + active timer) */
  dailyElapsedSeconds: number;
  activePieces: Piece[];
  /** Currently focused piece ID (for piece tabs / scrubber) */
  focusedPieceId: string | null;
  setFocusedPieceId: (id: string | null) => void;
  startTaskTimer: (taskId: string, seconds: number) => void;
  pauseTaskTimer: () => void;
  resetTaskTimer: (taskId: string, seconds: number) => void;
  /** Refresh the daily total from server data */
  refreshDailyTotal: () => void;
};

const TaskTimerContext = createContext<TaskTimerContextValue | null>(null);

export function useTaskTimer() {
  const ctx = useContext(TaskTimerContext);
  if (!ctx) {
    throw new Error("useTaskTimer must be used within a TaskTimerProvider");
  }
  return ctx;
}

export function TaskTimerProvider({
  activePieces,
  initialDailySeconds = 0,
  children,
}: {
  activePieces: Piece[];
  initialDailySeconds?: number;
  children: ReactNode;
}) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [restored, setRestored] = useState(false);
  const [baseDailySeconds, setBaseDailySeconds] = useState(initialDailySeconds);
  const [activeTaskElapsed, setActiveTaskElapsed] = useState(0);
  const [focusedPieceId, setFocusedPieceId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeTaskStartRef = useRef<number | null>(null);

  const dailyElapsedSeconds = baseDailySeconds + activeTaskElapsed;

  const persistTaskRemaining = useCallback((taskId: string, seconds: number) => {
    void updateTaskRemaining(taskId, seconds).catch(() => {});
    window.dispatchEvent(
      new CustomEvent("task-timer-paused", {
        detail: { taskId, remainingSeconds: seconds },
      })
    );
  }, []);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const state: PersistedState = JSON.parse(raw);
        const elapsed = Math.floor(
          (Date.now() - new Date(state.lastTickAt).getTime()) / 1000
        );
        // Remaining can go negative once the soft goal has been passed.
        const remaining = state.remainingSeconds - elapsed;
        setActiveTaskId(state.taskId);
        setRemainingSeconds(remaining);
        setIsExpired(remaining <= 0);
        activeTaskStartRef.current = Date.now() - elapsed * 1000;
      }
    } catch {
      // Ignore corrupt localStorage
    }
    setRestored(true);
  }, []);

  const persist = useCallback(
    (taskId: string | null, seconds: number) => {
      if (!restored) return;
      if (taskId) {
        const state: PersistedState = {
          taskId,
          remainingSeconds: seconds,
          lastTickAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    },
    [restored]
  );

  // Handle visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== "visible") return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw || !activeTaskId) return;
        const state: PersistedState = JSON.parse(raw);
        if (state.taskId !== activeTaskId) return;
        const elapsed = Math.floor(
          (Date.now() - new Date(state.lastTickAt).getTime()) / 1000
        );
        const remaining = state.remainingSeconds - elapsed;
        setRemainingSeconds(remaining);
        if (remaining <= 0) {
          setIsExpired(true);
        }
      } catch {
        // Ignore
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [activeTaskId]);

  // Countdown interval — keeps running past the soft goal so the user can
  // practice longer than planned without stopping the timer.
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!activeTaskId) return;

    const tickingTaskId = activeTaskId;
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;
        if (prev > 0 && next <= 0) {
          // Transition to goal-reached once, then keep counting into negatives.
          setIsExpired(true);
          persistTaskRemaining(tickingTaskId, 0);
        }
        return next;
      });
      // Update active task elapsed for daily total
      if (activeTaskStartRef.current) {
        setActiveTaskElapsed(
          Math.floor((Date.now() - activeTaskStartRef.current) / 1000)
        );
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeTaskId, persistTaskRemaining]);

  // Persist every 10 seconds while running (including past the soft goal, so
  // overtime is reflected on reload via the server's daily summary).
  const tickCount = useRef(0);
  useEffect(() => {
    if (!activeTaskId) {
      tickCount.current = 0;
      return;
    }
    tickCount.current++;
    if (tickCount.current % 10 === 0) {
      persist(activeTaskId, remainingSeconds);
      void updateTaskRemaining(activeTaskId, remainingSeconds).catch(() => {});
    }
  }, [remainingSeconds, activeTaskId, persist]);

  const refreshDailyTotal = useCallback(async () => {
    try {
      const { getTodaySummary } = await import("@/app/(app)/timer/actions");
      const summary = await getTodaySummary();
      const total = summary.reduce((sum, e) => sum + e.total_seconds, 0);
      setBaseDailySeconds(total);
    } catch {
      // Ignore
    }
  }, []);

  const startTaskTimer = useCallback(
    (taskId: string, seconds: number) => {
      if (activeTaskId && activeTaskId !== taskId) {
        persistTaskRemaining(activeTaskId, remainingSeconds);
        // Add the elapsed time from the previous task to the base total
        if (activeTaskStartRef.current) {
          const prevElapsed = Math.floor(
            (Date.now() - activeTaskStartRef.current) / 1000
          );
          setBaseDailySeconds((prev) => prev + prevElapsed);
        }
      }
      setActiveTaskId(taskId);
      setRemainingSeconds(seconds);
      setIsExpired(seconds <= 0);
      setActiveTaskElapsed(0);
      activeTaskStartRef.current = Date.now();
      persist(taskId, seconds);

      // Record started_at on server
      void startTaskTimerAction(taskId).catch(() => {});
    },
    [activeTaskId, remainingSeconds, persist, persistTaskRemaining]
  );

  const pauseTaskTimer = useCallback(() => {
    if (!activeTaskId) return;
    persistTaskRemaining(activeTaskId, remainingSeconds);

    // Add elapsed to base daily total
    if (activeTaskStartRef.current) {
      const elapsed = Math.floor(
        (Date.now() - activeTaskStartRef.current) / 1000
      );
      setBaseDailySeconds((prev) => prev + elapsed);
    }

    // Record ended_at on server
    void stopTaskTimerAction(activeTaskId).catch(() => {});

    localStorage.removeItem(STORAGE_KEY);
    setActiveTaskId(null);
    setActiveTaskElapsed(0);
    activeTaskStartRef.current = null;
  }, [activeTaskId, remainingSeconds, persistTaskRemaining]);

  const resetTaskTimer = useCallback(
    (taskId: string, seconds: number) => {
      setActiveTaskId(taskId);
      setRemainingSeconds(seconds);
      setIsExpired(false);
      setActiveTaskElapsed(0);
      activeTaskStartRef.current = Date.now();
      persist(taskId, seconds);
    },
    [persist]
  );

  return (
    <TaskTimerContext.Provider
      value={{
        activeTaskId,
        remainingSeconds,
        isExpired,
        dailyElapsedSeconds,
        activePieces,
        focusedPieceId,
        setFocusedPieceId,
        startTaskTimer,
        pauseTaskTimer,
        resetTaskTimer,
        refreshDailyTotal,
      }}
    >
      {children}
    </TaskTimerContext.Provider>
  );
}
