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
import { updateTaskRemaining } from "@/app/(app)/timer/task-actions";

const STORAGE_KEY = "practice-task-timer-state";

type PersistedState = {
  taskId: string;
  remainingSeconds: number;
  lastTickAt: string; // ISO timestamp of last tick
};

type TaskTimerContextValue = {
  activeTaskId: string | null;
  remainingSeconds: number;
  isExpired: boolean;
  startTaskTimer: (taskId: string, seconds: number) => void;
  pauseTaskTimer: () => void;
  resetTaskTimer: (taskId: string, seconds: number) => void;
};

const TaskTimerContext = createContext<TaskTimerContextValue | null>(null);

export function useTaskTimer() {
  const ctx = useContext(TaskTimerContext);
  if (!ctx) {
    throw new Error("useTaskTimer must be used within a TaskTimerProvider");
  }
  return ctx;
}

export function TaskTimerProvider({ children }: { children: ReactNode }) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [restored, setRestored] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist task remaining time and notify listeners so UI updates immediately.
  const persistTaskRemaining = useCallback((taskId: string, seconds: number) => {
    void updateTaskRemaining(taskId, seconds).catch(() => {
      // Ignore transient write failures; UI state remains local-first.
    });
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
        const remaining = Math.max(0, state.remainingSeconds - elapsed);
        setActiveTaskId(state.taskId);
        setRemainingSeconds(remaining);
        setIsExpired(remaining === 0);
      }
    } catch {
      // Ignore corrupt localStorage
    }
    setRestored(true);
  }, []);

  // Persist to localStorage
  const persist = useCallback(
    (taskId: string | null, seconds: number) => {
      if (!restored) return;
      if (taskId && seconds > 0) {
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

  // Handle visibility change — recalculate remaining time when tab regains focus
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
        const remaining = Math.max(0, state.remainingSeconds - elapsed);
        setRemainingSeconds(remaining);
        if (remaining === 0) {
          setIsExpired(true);
        }
      } catch {
        // Ignore
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [activeTaskId]);

  // Countdown interval — runs when activeTaskId is set and not expired
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!activeTaskId || isExpired || remainingSeconds <= 0) return;

    const tickingTaskId = activeTaskId;
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setIsExpired(true);
          // Persist the final 0 so reloads don't resurrect stale remaining time.
          persistTaskRemaining(tickingTaskId, 0);
          // Clear localStorage since timer is done
          localStorage.removeItem(STORAGE_KEY);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeTaskId, isExpired, remainingSeconds > 0, persistTaskRemaining]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist every 10 seconds while running
  const tickCount = useRef(0);
  useEffect(() => {
    if (!activeTaskId || isExpired || remainingSeconds <= 0) {
      tickCount.current = 0;
      return;
    }
    tickCount.current++;
    if (tickCount.current % 10 === 0) {
      persist(activeTaskId, remainingSeconds);
    }
  }, [remainingSeconds, activeTaskId, isExpired, persist]);

  const startTaskTimer = useCallback(
    (taskId: string, seconds: number) => {
      if (activeTaskId && activeTaskId !== taskId) {
        // Switching tasks should persist the previous task's current remaining time.
        persistTaskRemaining(activeTaskId, remainingSeconds);
      }
      setActiveTaskId(taskId);
      setRemainingSeconds(seconds);
      setIsExpired(seconds <= 0);
      persist(taskId, seconds);
    },
    [activeTaskId, remainingSeconds, persist, persistTaskRemaining]
  );

  const pauseTaskTimer = useCallback(() => {
    if (!activeTaskId) return;
    // Persist remaining to server
    persistTaskRemaining(activeTaskId, remainingSeconds);
    // Clear localStorage and active state
    localStorage.removeItem(STORAGE_KEY);
    setActiveTaskId(null);
  }, [activeTaskId, remainingSeconds, persistTaskRemaining]);

  const resetTaskTimer = useCallback(
    (taskId: string, seconds: number) => {
      setActiveTaskId(taskId);
      setRemainingSeconds(seconds);
      setIsExpired(false);
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
        startTaskTimer,
        pauseTaskTimer,
        resetTaskTimer,
      }}
    >
      {children}
    </TaskTimerContext.Provider>
  );
}
