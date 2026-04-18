"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PlayIcon,
  PauseIcon,
  SquareIcon,
  SkipBackIcon,
  Trash2Icon,
  Loader2Icon,
  AlertCircleIcon,
  MoreVerticalIcon,
  DownloadIcon,
} from "lucide-react";
import type WaveSurferType from "wavesurfer.js";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  createSignedPlaybackUrl,
  deleteTaskAudio,
} from "@/app/(app)/timer/audio-actions";
import { trimViewStyle } from "@/components/practice-table/task-audio-dialog";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; duration: number }
  | { kind: "error"; message: string }
  | { kind: "deleting" };

type Props = {
  taskId: string;
  audioPath: string;
  initialDuration: number;
  trimStartSeconds: number | null;
  trimEndSeconds: number | null;
  selected?: boolean;
  downloadFilename?: string;
  onDeleted?: () => void;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function RecordingPlayer({
  taskId,
  audioPath,
  initialDuration,
  trimStartSeconds,
  trimEndSeconds,
  selected = false,
  downloadFilename,
  onDeleted,
}: Props) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurferType | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const loadStartedRef = useRef(false);
  const pendingPlayRef = useRef(false);

  useEffect(() => {
    return () => {
      try {
        wsRef.current?.destroy();
      } catch {}
      wsRef.current = null;
    };
  }, []);

  const load = useCallback(async () => {
    if (!container) return;
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;
    setState({ kind: "loading" });
    try {
      const signedUrl = await createSignedPlaybackUrl(audioPath);
      const { default: WaveSurfer } = await import("wavesurfer.js");
      const ws = WaveSurfer.create({
        container,
        waveColor: "#a1a1aa",
        progressColor: "#ef4444",
        cursorColor: "#ef4444",
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        height: 56,
        url: signedUrl,
        interact: true,
      });
      wsRef.current = ws;
      ws.on("play", () => setPlaying(true));
      ws.on("pause", () => setPlaying(false));
      ws.on("finish", () => setPlaying(false));
      ws.on("timeupdate", (t: number) => setCurrentTime(t));
      ws.on("ready", (d: number) => {
        setState({ kind: "ready", duration: d });
        const effStart = trimStartSeconds ?? 0;
        const effEnd = trimEndSeconds ?? d;
        const hasTrim = trimStartSeconds != null || trimEndSeconds != null;
        try {
          ws.setTime(effStart);
        } catch {}
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          if (hasTrim) {
            void ws.play(effStart, effEnd);
          } else {
            void ws.play();
          }
        }
      });
    } catch (err) {
      loadStartedRef.current = false;
      const message =
        err instanceof Error ? err.message : "Could not load recording";
      setState({ kind: "error", message });
    }
  }, [audioPath, container, trimStartSeconds, trimEndSeconds]);

  const togglePlay = useCallback(() => {
    if (state.kind === "idle") {
      pendingPlayRef.current = true;
      void load();
      return;
    }
    if (state.kind === "loading") {
      pendingPlayRef.current = true;
      return;
    }
    const ws = wsRef.current;
    if (!ws) return;
    if (ws.isPlaying()) {
      ws.pause();
      return;
    }
    const total = ws.getDuration();
    const effStart = trimStartSeconds ?? 0;
    const effEnd = trimEndSeconds ?? total;
    const hasTrim = trimStartSeconds != null || trimEndSeconds != null;
    const now = ws.getCurrentTime();
    if (now < effStart - 0.001 || now >= effEnd - 0.001) {
      try {
        ws.setTime(effStart);
      } catch {}
    }
    if (hasTrim) {
      void ws.play(effStart, effEnd);
    } else {
      void ws.play();
    }
  }, [load, state.kind, trimStartSeconds, trimEndSeconds]);

  const skipToStart = useCallback(() => {
    wsRef.current?.setTime(trimStartSeconds ?? 0);
  }, [trimStartSeconds]);

  // Lazy-render the waveform as soon as the player scrolls near the viewport.
  useEffect(() => {
    if (!container) return;
    if (state.kind !== "idle") return;
    if (typeof IntersectionObserver === "undefined") {
      void load();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void load();
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(container);
    return () => io.disconnect();
  }, [container, state.kind, load]);

  useEffect(() => {
    if (!selected) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          tag === "BUTTON" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, togglePlay]);

  const stopTransport = useCallback(() => {
    wsRef.current?.pause();
  }, []);

  const onDownload = useCallback(async () => {
    setMenuOpen(false);
    try {
      const signedUrl = await createSignedPlaybackUrl(audioPath);
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const basename = audioPath.split("/").pop() ?? "recording";
      const ext = basename.includes(".") ? basename.split(".").pop()! : "webm";
      const name = downloadFilename ? `${downloadFilename}.${ext}` : basename;
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      setState({ kind: "error", message });
    }
  }, [audioPath, downloadFilename]);

  const onDelete = useCallback(async () => {
    setMenuOpen(false);
    setState({ kind: "deleting" });
    try {
      await deleteTaskAudio(taskId);
      onDeleted?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setState({ kind: "error", message });
    }
  }, [onDeleted, taskId]);

  const duration =
    state.kind === "ready" ? state.duration : initialDuration;
  const controlsDisabled = state.kind !== "ready";

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-md bg-muted/40">
        <div
          ref={setContainer}
          className="min-h-[56px]"
          style={trimViewStyle(duration, trimStartSeconds, trimEndSeconds)}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={skipToStart}
            disabled={controlsDisabled}
            aria-label="Jump to start"
            title="Jump to start"
          >
            <SkipBackIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={togglePlay}
            disabled={state.kind === "loading" || state.kind === "deleting"}
            aria-label={playing ? "Pause" : "Play"}
            title={playing ? "Pause" : "Play"}
          >
            {state.kind === "loading" ? (
              <Loader2Icon className="animate-spin" />
            ) : playing ? (
              <PauseIcon />
            ) : (
              <PlayIcon />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={stopTransport}
            disabled={controlsDisabled}
            aria-label="Stop"
            title="Stop"
          >
            <SquareIcon fill="currentColor" />
          </Button>
        </div>

        <div className="text-xs tabular-nums text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {state.kind === "error" && (
          <div className="flex items-center gap-1 text-xs text-red-500">
            <AlertCircleIcon className="size-3.5" />
            <span>{state.message}</span>
          </div>
        )}

        <div className="ml-auto">
          <Button
            ref={menuRef}
            variant="ghost"
            size="icon-sm"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Recording options"
          >
            <MoreVerticalIcon />
          </Button>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuContent
              anchor={menuRef}
              align="end"
              side="bottom"
              className="w-40"
            >
              <DropdownMenuItem onClick={onDownload}>
                <DownloadIcon />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
