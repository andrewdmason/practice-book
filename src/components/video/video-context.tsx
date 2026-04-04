"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { PieceVideo, PieceSectionTimestamp } from "@/lib/types";
import { getVideos, getTimestamps } from "@/app/(app)/repertoire/video-actions";

/* ------------------------------------------------------------------ */
/*  Minimal YT types (avoids @types/youtube dependency)                */
/* ------------------------------------------------------------------ */

interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}

// YouTube player states
const YT_PLAYING = 1;

/* ------------------------------------------------------------------ */
/*  Context value                                                      */
/* ------------------------------------------------------------------ */

interface VideoContextValue {
  /** Currently loaded YouTube video ID */
  videoId: string | null;
  /** Video-level start constraint (0 if unset) */
  videoStart: number;
  /** Video-level end constraint (null = use full duration) */
  videoEnd: number | null;
  /** Ref to the YT.Player instance */
  playerRef: React.MutableRefObject<YTPlayer | null>;
  /** Current playback time (absolute, polled) */
  currentTime: number;
  /** Total video duration */
  duration: number;
  /** Whether the video is currently playing */
  isPlaying: boolean;
  /** Seek to a time (clamped to video range) */
  seekTo: (seconds: number) => void;
  /** Start playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Load a video */
  setVideo: (
    youtubeVideoId: string,
    startSeconds?: number | null,
    endSeconds?: number | null
  ) => void;
  /** Unload the video */
  clearVideo: () => void;
  /** Load videos + timestamps for a piece */
  loadPieceVideo: (pieceId: string) => Promise<void>;
  /** Currently loaded piece video data */
  activeVideo: PieceVideo | null;
  /** Timestamps for the active video */
  timestamps: PieceSectionTimestamp[];
  /** The piece ID whose video is loaded */
  videoPieceId: string | null;
  /** Whether the video player is visible */
  showVideo: boolean;
  /** Toggle video player visibility */
  setShowVideo: (show: boolean) => void;
  /** Called by the player component when the YT player is ready */
  notifyPlayerReady: () => void;
}

const VideoContext = createContext<VideoContextValue | null>(null);

export function useVideo() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error("useVideo must be used within VideoProvider");
  return ctx;
}

export function useVideoOptional() {
  return useContext(VideoContext);
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function VideoProvider({ children }: { children: ReactNode }) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoStart, setVideoStart] = useState(0);
  const [videoEnd, setVideoEnd] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeVideo, setActiveVideo] = useState<PieceVideo | null>(null);
  const [timestamps, setTimestamps] = useState<PieceSectionTimestamp[]>([]);
  const [videoPieceId, setVideoPieceId] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  const playerRef = useRef<YTPlayer | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingActionRef = useRef<{ seekTo: number; play: boolean } | null>(null);

  // Poll current time when playing
  useEffect(() => {
    if (isPlaying) {
      pollRef.current = setInterval(() => {
        const player = playerRef.current;
        if (!player) return;

        const time = player.getCurrentTime();
        setCurrentTime(time);

        // Update duration if not set
        const dur = player.getDuration();
        if (dur > 0) setDuration(dur);

        // Clamp to video end
        const end = videoEnd ?? dur;
        if (end > 0 && time >= end) {
          player.pauseVideo();
          player.seekTo(end, true);
          setIsPlaying(false);
        }
      }, 250);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isPlaying, videoEnd]);

  const seekTo = useCallback(
    (seconds: number) => {
      const player = playerRef.current;
      if (!player) {
        // Queue for when player mounts
        pendingActionRef.current = { seekTo: seconds, play: pendingActionRef.current?.play ?? false };
        setCurrentTime(seconds);
        return;
      }
      const end = videoEnd ?? duration;
      const clamped = Math.max(videoStart, Math.min(seconds, end || seconds));
      player.seekTo(clamped, true);
      setCurrentTime(clamped);
    },
    [videoStart, videoEnd, duration]
  );

  const play = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      // Queue for when player mounts
      pendingActionRef.current = { seekTo: pendingActionRef.current?.seekTo ?? 0, play: true };
      return;
    }
    player.playVideo();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    player.pauseVideo();
    setIsPlaying(false);
  }, []);

  const setVideo = useCallback(
    (
      youtubeVideoId: string,
      startSeconds?: number | null,
      endSeconds?: number | null
    ) => {
      setVideoId(youtubeVideoId);
      setVideoStart(startSeconds ?? 0);
      setVideoEnd(endSeconds ?? null);
      setCurrentTime(startSeconds ?? 0);
    },
    []
  );

  const clearVideo = useCallback(() => {
    setVideoId(null);
    setVideoStart(0);
    setVideoEnd(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setActiveVideo(null);
    setTimestamps([]);
    setVideoPieceId(null);
  }, []);

  const loadPieceVideo = useCallback(async (pieceId: string) => {
    const videos = await getVideos(pieceId);
    if (videos.length === 0) {
      setActiveVideo(null);
      setTimestamps([]);
      setVideoPieceId(null);
      setVideoId(null);
      return;
    }

    const video = videos[0]; // Use first video
    setActiveVideo(video);
    setVideoPieceId(pieceId);
    setVideoId(video.youtube_video_id);
    setVideoStart(video.start_seconds ?? 0);
    setVideoEnd(video.end_seconds ?? null);
    setCurrentTime(video.start_seconds ?? 0);

    const ts = await getTimestamps(video.id);
    setTimestamps(ts);
  }, []);

  // Expose a way for the player component to update isPlaying from YT events
  const handlePlayerStateChange = useCallback((state: number) => {
    setIsPlaying(state === YT_PLAYING);
  }, []);

  const notifyPlayerReady = useCallback(() => {
    const pending = pendingActionRef.current;
    if (!pending) return;
    pendingActionRef.current = null;
    const player = playerRef.current;
    if (!player) return;
    if (pending.seekTo > 0) {
      player.seekTo(pending.seekTo, true);
      setCurrentTime(pending.seekTo);
    }
    if (pending.play) {
      player.playVideo();
      setIsPlaying(true);
    }
  }, []);

  return (
    <VideoContext.Provider
      value={{
        videoId,
        videoStart,
        videoEnd,
        playerRef,
        currentTime,
        duration,
        isPlaying,
        seekTo,
        play,
        pause,
        setVideo,
        clearVideo,
        loadPieceVideo,
        activeVideo,
        timestamps,
        videoPieceId,
        showVideo,
        setShowVideo,
        notifyPlayerReady,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
}

/** Exported for use by the YouTube player component */
export { YT_PLAYING };
export type { YTPlayer };
