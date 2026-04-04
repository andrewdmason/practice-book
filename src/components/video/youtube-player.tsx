"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { VideoIcon } from "lucide-react";
import { useVideo, YT_PLAYING, type YTPlayer } from "./video-context";

/* ------------------------------------------------------------------ */
/*  YouTube IFrame API loader                                          */
/* ------------------------------------------------------------------ */

function loadYouTubeApi(): Promise<void> {
  const win = window as unknown as Record<string, unknown>;
  if (win.YT && (win.YT as Record<string, unknown>).Player) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const existing = win.__ytApiCallbacks as (() => void)[] | undefined;
    if (existing) {
      existing.push(resolve);
      return;
    }

    const callbacks = [resolve];
    win.__ytApiCallbacks = callbacks;

    win.onYouTubeIframeAPIReady = () => {
      callbacks.forEach((cb) => cb());
      callbacks.length = 0;
      delete win.__ytApiCallbacks;
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function YouTubePlayer({ bare = false }: { bare?: boolean } = {}) {
  const videoCtx = useVideo();
  const { videoId, videoStart, videoEnd, playerRef } = videoCtx;
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const localPlayerRef = useRef<YTPlayer | null>(null);
  const mountedVideoId = useRef<string | null>(null);
  const creatingRef = useRef(false);

  const createPlayer = useCallback(async () => {
    if (!videoId || !containerRef.current || creatingRef.current) return;

    // Already have a player for this video
    if (localPlayerRef.current && mountedVideoId.current === videoId) {
      setReady(true);
      return;
    }

    // Destroy previous local player if video changed
    if (localPlayerRef.current) {
      localPlayerRef.current.destroy();
      localPlayerRef.current = null;
      if (playerRef.current === localPlayerRef.current) {
        playerRef.current = null;
      }
      setReady(false);
    }

    creatingRef.current = true;

    await loadYouTubeApi();

    // Guard: container may have been unmounted while loading API
    if (!containerRef.current) {
      creatingRef.current = false;
      return;
    }

    mountedVideoId.current = videoId;

    const YT = (window as unknown as Record<string, unknown>).YT as {
      Player: new (
        el: HTMLElement,
        config: Record<string, unknown>
      ) => YTPlayer;
    };

    const playerVars: Record<string, unknown> = {
      rel: 0,
      modestbranding: 1,
    };
    if (videoStart > 0) playerVars.start = Math.floor(videoStart);
    if (videoEnd != null) playerVars.end = Math.ceil(videoEnd);

    const player = new YT.Player(containerRef.current, {
      videoId,
      width: "100%",
      height: "100%",
      playerVars,
      events: {
        onReady: () => {
          localPlayerRef.current = player;
          playerRef.current = player;
          creatingRef.current = false;
          setReady(true);
          videoCtx.notifyPlayerReady();
        },
        onStateChange: (event: { data: number }) => {
          if (event.data === YT_PLAYING) {
            videoCtx.play();
          } else if (event.data === 2 || event.data === 0) {
            videoCtx.pause();
          }
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, videoStart, videoEnd]);

  // Create player when videoId is available
  useEffect(() => {
    createPlayer();
  }, [createPlayer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localPlayerRef.current) {
        localPlayerRef.current.destroy();
        localPlayerRef.current = null;
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!videoId) return null;

  if (bare) {
    return (
      <div className="absolute inset-0">
        <div ref={containerRef} className="absolute inset-0" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Loading video...
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        <VideoIcon className="size-3.5" />
        Video
      </h3>
      <div className="rounded-md overflow-hidden">
        <div className="relative aspect-video bg-muted">
          <div ref={containerRef} className="absolute inset-0" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Loading video...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
