"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusIcon, Trash2Icon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { YouTubePlayer } from "@/components/video/youtube-player";
import { useVideo } from "@/components/video/video-context";
import {
  createVideo,
  deleteVideo,
  updateVideoTimeRange,
  upsertTimestamp,
  deleteTimestamp,
} from "@/app/(app)/repertoire/video-actions";
import type {
  PieceVideo,
  PieceSection,
  PieceSectionTimestamp,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Time formatting helpers                                            */
/* ------------------------------------------------------------------ */

function formatMMSS(seconds: number | null): string {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseMMSS(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Support M:SS or just seconds
  const parts = trimmed.split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (isNaN(m) || isNaN(s)) return null;
    return m * 60 + s;
  }
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

/* ------------------------------------------------------------------ */
/*  Add Video Form                                                     */
/* ------------------------------------------------------------------ */

function AddVideoForm({
  pieceId,
  onAdded,
}: {
  pieceId: string;
  onAdded: () => void;
}) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const extractVideoId = (input: string): string | null => {
    const trimmed = input.trim();
    // Direct video ID (11 chars)
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    // YouTube URL patterns
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const match = trimmed.match(p);
      if (match) return match[1];
    }
    return null;
  };

  const handleSubmit = async () => {
    const videoId = extractVideoId(url);
    if (!videoId) return;
    setSaving(true);
    await createVideo(pieceId, videoId);
    setUrl("");
    setSaving(false);
    onAdded();
  };

  return (
    <div className="flex items-center gap-2">
      <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="YouTube URL or video ID"
        className="h-8 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleSubmit}
        disabled={saving || !extractVideoId(url)}
        className="h-8"
      >
        <PlusIcon className="size-3.5 mr-1" />
        Add
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Video Time Range Editor                                            */
/* ------------------------------------------------------------------ */

function VideoTimeRange({
  video,
  onUpdated,
}: {
  video: PieceVideo;
  onUpdated: () => void;
}) {
  const { currentTime } = useVideo();
  const [startValue, setStartValue] = useState(
    formatMMSS(video.start_seconds)
  );
  const [endValue, setEndValue] = useState(formatMMSS(video.end_seconds));

  useEffect(() => {
    setStartValue(formatMMSS(video.start_seconds));
    setEndValue(formatMMSS(video.end_seconds));
  }, [video.start_seconds, video.end_seconds]);

  const save = async (
    start: number | null,
    end: number | null
  ) => {
    await updateVideoTimeRange(video.id, start, end);
    onUpdated();
  };

  const handleMarkStart = () => {
    const rounded = Math.floor(currentTime);
    setStartValue(formatMMSS(rounded));
    save(rounded, parseMMSS(endValue));
  };

  const handleMarkEnd = () => {
    const rounded = Math.ceil(currentTime);
    setEndValue(formatMMSS(rounded));
    save(parseMMSS(startValue), rounded);
  };

  const handleBlurStart = () => {
    const parsed = parseMMSS(startValue);
    save(parsed, parseMMSS(endValue));
  };

  const handleBlurEnd = () => {
    const parsed = parseMMSS(endValue);
    save(parseMMSS(startValue), parsed);
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-xs text-muted-foreground shrink-0">
        Video range:
      </span>
      <div className="flex items-center gap-1">
        <Input
          value={startValue}
          onChange={(e) => setStartValue(e.target.value)}
          onBlur={handleBlurStart}
          placeholder="0:00"
          className="h-7 w-16 text-xs font-mono text-center"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleMarkStart}
          className="h-7 text-xs px-1.5"
        >
          Mark
        </Button>
      </div>
      <span className="text-muted-foreground">—</span>
      <div className="flex items-center gap-1">
        <Input
          value={endValue}
          onChange={(e) => setEndValue(e.target.value)}
          onBlur={handleBlurEnd}
          placeholder="end"
          className="h-7 w-16 text-xs font-mono text-center"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleMarkEnd}
          className="h-7 text-xs px-1.5"
        >
          Mark
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timestamp Row                                                      */
/* ------------------------------------------------------------------ */

function TimestampRow({
  section,
  videoId,
  timestamp,
  onUpdated,
}: {
  section: PieceSection;
  videoId: string;
  timestamp: PieceSectionTimestamp | undefined;
  onUpdated: () => void;
}) {
  const { currentTime } = useVideo();
  const [startValue, setStartValue] = useState(
    formatMMSS(timestamp?.start_seconds ?? null)
  );
  const [endValue, setEndValue] = useState(
    formatMMSS(timestamp?.end_seconds ?? null)
  );

  useEffect(() => {
    setStartValue(formatMMSS(timestamp?.start_seconds ?? null));
    setEndValue(formatMMSS(timestamp?.end_seconds ?? null));
  }, [timestamp?.start_seconds, timestamp?.end_seconds]);

  const saveTimestamp = async (start: number, end?: number | null) => {
    await upsertTimestamp(section.id, videoId, start, end);
    onUpdated();
  };

  const handleMarkStart = () => {
    const rounded = Math.floor(currentTime);
    setStartValue(formatMMSS(rounded));
    const endParsed = parseMMSS(endValue);
    saveTimestamp(rounded, endParsed);
  };

  const handleMarkEnd = () => {
    const rounded = Math.ceil(currentTime);
    setEndValue(formatMMSS(rounded));
    const startParsed = parseMMSS(startValue);
    if (startParsed != null) {
      saveTimestamp(startParsed, rounded);
    }
  };

  const handleBlurStart = () => {
    const parsed = parseMMSS(startValue);
    if (parsed != null) {
      saveTimestamp(parsed, parseMMSS(endValue));
    }
  };

  const handleBlurEnd = () => {
    const startParsed = parseMMSS(startValue);
    if (startParsed != null) {
      saveTimestamp(startParsed, parseMMSS(endValue));
    }
  };

  const handleClear = async () => {
    if (timestamp) {
      await deleteTimestamp(section.id, videoId);
      setStartValue("");
      setEndValue("");
      onUpdated();
    }
  };

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-10 text-xs font-medium text-muted-foreground shrink-0">
        {section.label}
      </span>
      <Input
        value={startValue}
        onChange={(e) => setStartValue(e.target.value)}
        onBlur={handleBlurStart}
        placeholder="—"
        className="h-7 w-16 text-xs font-mono text-center"
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={handleMarkStart}
        className="h-7 text-xs px-1.5"
      >
        Mark
      </Button>
      <Input
        value={endValue}
        onChange={(e) => setEndValue(e.target.value)}
        onBlur={handleBlurEnd}
        placeholder="—"
        className="h-7 w-16 text-xs font-mono text-center"
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={handleMarkEnd}
        className="h-7 text-xs px-1.5"
      >
        Mark
      </Button>
      {timestamp && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleClear}
          className="h-7 text-xs px-1.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon className="size-3" />
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Editor                                                        */
/* ------------------------------------------------------------------ */

export function SectionTimestampEditor({
  pieceId,
  sections,
  initialVideos,
  initialTimestamps,
}: {
  pieceId: string;
  sections: PieceSection[];
  initialVideos: PieceVideo[];
  initialTimestamps: PieceSectionTimestamp[];
}) {
  const video = useVideo();
  const [videos, setVideos] = useState(initialVideos);
  const [timestamps, setTimestamps] = useState(initialTimestamps);
  const activeVideo = videos[0] ?? null;

  // Load video into context when component mounts
  useEffect(() => {
    if (activeVideo) {
      video.setVideo(
        activeVideo.youtube_video_id,
        activeVideo.start_seconds,
        activeVideo.end_seconds
      );
    }
    return () => {
      video.clearVideo();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideo?.id]);

  const refreshData = useCallback(async () => {
    const { getVideos, getTimestamps } = await import(
      "@/app/(app)/repertoire/video-actions"
    );
    const newVideos = await getVideos(pieceId);
    setVideos(newVideos);
    if (newVideos[0]) {
      const newTimestamps = await getTimestamps(newVideos[0].id);
      setTimestamps(newTimestamps);
      // Update video context with potentially changed time range
      video.setVideo(
        newVideos[0].youtube_video_id,
        newVideos[0].start_seconds,
        newVideos[0].end_seconds
      );
    } else {
      setTimestamps([]);
      video.clearVideo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceId]);

  const handleDeleteVideo = async () => {
    if (!activeVideo) return;
    await deleteVideo(activeVideo.id);
    refreshData();
  };

  if (!activeVideo && videos.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Video
        </h4>
        <AddVideoForm pieceId={pieceId} onAdded={refreshData} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Video
        </h4>
        {activeVideo && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDeleteVideo}
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon className="size-3 mr-1" />
            Remove
          </Button>
        )}
      </div>

      {activeVideo && <VideoTimeRange video={activeVideo} onUpdated={refreshData} />}

      <YouTubePlayer defaultOpen />

      {activeVideo && sections.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">
            <span className="w-10">Section</span>
            <span className="w-16 text-center">Start</span>
            <span className="w-12" />
            <span className="w-16 text-center">End</span>
          </div>
          {sections.map((section) => (
            <TimestampRow
              key={section.id}
              section={section}
              videoId={activeVideo.id}
              timestamp={timestamps.find(
                (t) => t.section_id === section.id
              )}
              onUpdated={refreshData}
            />
          ))}
        </div>
      )}

      {!activeVideo && (
        <AddVideoForm pieceId={pieceId} onAdded={refreshData} />
      )}
    </div>
  );
}
