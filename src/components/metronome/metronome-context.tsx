"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type MetronomeContextValue = {
  bpm: number;
  setBpm: (bpm: number) => void;
  isActive: boolean;
  toggle: () => void;
  start: (bpm?: number) => void;
  stop: () => void;
  beatPulse: number;
};

const MetronomeContext = createContext<MetronomeContextValue | null>(null);

const STORAGE_KEY = "practice-metronome-state";
const DEFAULT_BPM = 60;
const MIN_BPM = 20;
const MAX_BPM = 300;
const SCHEDULE_INTERVAL_MS = 25;
const LOOKAHEAD_S = 0.1;

// Standard mechanical metronome markings (Maelzel)
const STANDARD_TEMPOS = [
  20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56,
  58, 60, 63, 66, 69, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116,
  120, 126, 132, 138, 144, 152, 160, 168, 176, 184, 192, 200, 208, 216, 224,
  232, 240, 252, 264, 276, 288, 300,
];

function nextStandardTempo(current: number): number {
  for (const t of STANDARD_TEMPOS) {
    if (t > current) return t;
  }
  return MAX_BPM;
}

function prevStandardTempo(current: number): number {
  for (let i = STANDARD_TEMPOS.length - 1; i >= 0; i--) {
    if (STANDARD_TEMPOS[i] < current) return STANDARD_TEMPOS[i];
  }
  return MIN_BPM;
}

function clampBpm(bpm: number): number {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));
}

function loadState(): { bpm: number; isActive: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        bpm: clampBpm(parsed.bpm ?? DEFAULT_BPM),
        isActive: Boolean(parsed.isActive),
      };
    }
  } catch {
    // ignore
  }
  return { bpm: DEFAULT_BPM, isActive: false };
}

function saveState(bpm: number, isActive: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bpm, isActive }));
  } catch {
    // ignore
  }
}

export function MetronomeProvider({ children }: { children: React.ReactNode }) {
  const [bpm, setBpmState] = useState(DEFAULT_BPM);
  const [isActive, setIsActive] = useState(false);
  const [beatPulse, setBeatPulse] = useState(0);
  const [restored, setRestored] = useState(false);
  const hasBeenStarted = useRef(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextBeatTimeRef = useRef(0);
  const bpmRef = useRef(bpm);

  // Keep bpmRef in sync
  bpmRef.current = bpm;

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = loadState();
    setBpmState(saved.bpm);
    if (saved.isActive) {
      // Don't auto-play on mount — just remember the BPM.
      // Audio requires user gesture, so we restore BPM but not active state.
    }
    setRestored(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!restored) return;
    saveState(bpm, isActive);
  }, [bpm, isActive, restored]);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const noiseBufferRef = useRef<AudioBuffer | null>(null);

  const getNoiseBuffer = useCallback((ctx: AudioContext) => {
    if (noiseBufferRef.current) return noiseBufferRef.current;
    const length = Math.ceil(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noiseBufferRef.current = buffer;
    return buffer;
  }, []);

  const scheduleClick = useCallback(
    (ctx: AudioContext, time: number) => {
      // Layer 1: short noise burst for percussive attack
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 4000;
      noiseFilter.Q.value = 1.5;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(1.5, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(time);
      noise.stop(time + 0.03);

      // Layer 2: pitched click for tonal definition
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      osc.frequency.setValueAtTime(1800, time);
      osc.frequency.exponentialRampToValueAtTime(800, time + 0.02);
      osc.type = "square";
      oscGain.gain.setValueAtTime(0.6, time);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);

      osc.start(time);
      osc.stop(time + 0.025);
    },
    [getNoiseBuffer]
  );

  const startScheduler = useCallback(() => {
    const ctx = getAudioContext();
    nextBeatTimeRef.current = ctx.currentTime;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const currentTime = ctx.currentTime;
      while (nextBeatTimeRef.current < currentTime + LOOKAHEAD_S) {
        scheduleClick(ctx, nextBeatTimeRef.current);
        setBeatPulse((p) => p + 1);
        const secondsPerBeat = 60 / bpmRef.current;
        nextBeatTimeRef.current += secondsPerBeat;
      }
    }, SCHEDULE_INTERVAL_MS);
  }, [getAudioContext, scheduleClick]);

  const stopScheduler = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(
    (newBpm?: number) => {
      if (newBpm !== undefined) {
        const clamped = clampBpm(newBpm);
        setBpmState(clamped);
        bpmRef.current = clamped;
      }
      hasBeenStarted.current = true;
      setIsActive(true);
      // Stop existing scheduler before starting fresh
      stopScheduler();
      // Use microtask to ensure state is updated before starting
      queueMicrotask(() => startScheduler());
    },
    [stopScheduler, startScheduler]
  );

  const stop = useCallback(() => {
    setIsActive(false);
    stopScheduler();
  }, [stopScheduler]);

  const toggle = useCallback(() => {
    if (isActive) {
      stop();
    } else {
      start();
    }
  }, [isActive, start, stop]);

  const setBpm = useCallback(
    (newBpm: number) => {
      const clamped = clampBpm(newBpm);
      setBpmState(clamped);
      bpmRef.current = clamped;
      // If active, restart scheduler to pick up new BPM immediately
      if (isActive) {
        stopScheduler();
        startScheduler();
      }
    },
    [isActive, stopScheduler, startScheduler]
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isEditable = (e.target as HTMLElement).isContentEditable;
      const inInput =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isEditable;

      // Shift+Z: always toggle (unless in input)
      if (e.key === "Z" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (inInput) return;
        e.preventDefault();
        toggle();
        return;
      }

      // Spacebar: toggle only if metronome has been started and not in input
      if (e.key === " " && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (inInput) return;
        if (!hasBeenStarted.current) return;
        e.preventDefault();
        toggle();
        return;
      }

      // Arrow keys: adjust BPM by standard metronome increments (only when active)
      if (e.key === "ArrowRight" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (inInput) return;
        if (!isActive) return;
        e.preventDefault();
        setBpm(nextStandardTempo(bpmRef.current));
        return;
      }
      if (e.key === "ArrowLeft" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (inInput) return;
        if (!isActive) return;
        e.preventDefault();
        setBpm(prevStandardTempo(bpmRef.current));
        return;
      }

      // Up/Down arrows: double or halve BPM
      if (e.key === "ArrowUp" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (inInput) return;
        if (!isActive) return;
        e.preventDefault();
        setBpm(bpmRef.current * 2);
        return;
      }
      if (e.key === "ArrowDown" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (inInput) return;
        if (!isActive) return;
        e.preventDefault();
        setBpm(Math.round(bpmRef.current / 2));
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle, setBpm, isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScheduler();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, [stopScheduler]);

  return (
    <MetronomeContext.Provider
      value={{ bpm, setBpm, isActive, toggle, start, stop, beatPulse }}
    >
      {children}
    </MetronomeContext.Provider>
  );
}

export function useMetronome() {
  const ctx = useContext(MetronomeContext);
  if (!ctx) {
    throw new Error("useMetronome must be used within a MetronomeProvider");
  }
  return ctx;
}
