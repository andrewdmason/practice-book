"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CircleIcon,
  LinkIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { YouTubePlayer } from "@/components/video/youtube-player";
import { useVideo } from "@/components/video/video-context";
import {
  getSections,
  createSection,
  updateSectionStatus,
  updateSectionTargetTempo,
  updatePieceTargetTempo,
  deleteSection,
} from "@/app/(app)/repertoire/section-actions";
import {
  createVideo,
  deleteVideo,
  getVideos,
  getTimestamps,
  updateVideoTimeRange,
  upsertTimestamp,
} from "@/app/(app)/repertoire/video-actions";
import type {
  PieceSectionWithChildren,
  PieceSection,
  PieceVideo,
  PieceSectionTimestamp,
  SectionStatus,
} from "@/lib/types";
import {
  SECTION_STATUS_LABELS,
  SECTION_STATUS_DOT_COLORS,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function nextSectionLetter(sections: PieceSectionWithChildren[]): string {
  if (sections.length === 0) return "A";
  const letters = sections.map((s) => s.label);
  const lastLetter = letters[letters.length - 1];
  return String.fromCharCode(lastLetter.charCodeAt(0) + 1);
}

function nextSubsectionLabel(parent: PieceSectionWithChildren): string {
  const num = parent.children.length + 1;
  return `${parent.label}${num}`;
}

function formatMMSS(seconds: number | null): string {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseMMSS(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
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

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/* ------------------------------------------------------------------ */
/*  Flat row type                                                      */
/* ------------------------------------------------------------------ */

type FlatRow = {
  section: PieceSection;
  parent: PieceSectionWithChildren;
};

function buildFlatRows(sections: PieceSectionWithChildren[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const s of sections) {
    if (s.children.length > 0) {
      // Skip parent row, show children only
      for (const child of s.children) {
        rows.push({ section: child, parent: s });
      }
    } else {
      rows.push({ section: s, parent: s });
    }
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Gutter insert button                                               */
/* ------------------------------------------------------------------ */

function GutterInsert({ onClick }: { onClick: () => void }) {
  return (
    <div className="group/insert relative h-0 my-0">
      <div className="absolute inset-x-0 -top-1.5 -bottom-1.5 flex items-center opacity-0 group-hover/insert:opacity-100 transition-opacity z-10">
        <button
          onClick={onClick}
          className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0 hover:scale-110 transition-transform"
        >
          <PlusIcon className="size-2.5" />
        </button>
        <div className="flex-1 h-px bg-primary/30" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Row                                                        */
/* ------------------------------------------------------------------ */

function SectionRow({
  section,
  pieceTargetTempo,
  hasVideo,
  videoId,
  timestamp,
  playingSectionId,
  onStatusCycle,
  onDelete,
  onTempoChange,
  onTimestampUpdated,
}: {
  section: PieceSection;
  pieceTargetTempo: number | null;
  hasVideo: boolean;
  videoId: string | null;
  timestamp: PieceSectionTimestamp | undefined;
  playingSectionId: string | null;
  onStatusCycle: () => void;
  onDelete: () => void;
  onTempoChange: (tempo: number | null) => void;
  onTimestampUpdated: () => void;
}) {
  const video = useVideo();
  const { currentTime } = video;
  const [editingTempo, setEditingTempo] = useState(false);
  const effectiveTempo = section.target_tempo ?? pieceTargetTempo;
  const [tempoValue, setTempoValue] = useState(
    String(section.target_tempo ?? "")
  );

  const [tsValue, setTsValue] = useState(
    formatMMSS(timestamp?.start_seconds ?? null)
  );

  useEffect(() => {
    setTsValue(formatMMSS(timestamp?.start_seconds ?? null));
  }, [timestamp?.start_seconds]);

  const handleSaveTempo = () => {
    setEditingTempo(false);
    const parsed = tempoValue.trim() ? parseInt(tempoValue, 10) : null;
    const value = parsed && !isNaN(parsed) ? parsed : null;
    onTempoChange(value);
  };

  const handleMark = async () => {
    if (!videoId) return;
    const rounded = Math.floor(currentTime);
    setTsValue(formatMMSS(rounded));
    await upsertTimestamp(section.id, videoId, rounded, null);
    onTimestampUpdated();
  };

  const handleBlurTimestamp = async () => {
    if (!videoId) return;
    const parsed = parseMMSS(tsValue);
    if (parsed != null) {
      await upsertTimestamp(section.id, videoId, parsed, null);
      onTimestampUpdated();
    }
  };

  return (
    <div className="group/row flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 transition-colors">
      {/* Status dot */}
      <Tooltip>
        <TooltipTrigger onClick={onStatusCycle} className="shrink-0">
          <CircleIcon
            className={cn(
              "size-3 fill-current",
              SECTION_STATUS_DOT_COLORS[section.status]
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">{SECTION_STATUS_LABELS[section.status]}</p>
        </TooltipContent>
      </Tooltip>

      {/* Label */}
      <span className="text-sm font-medium min-w-[2rem]">
        {section.label}
      </span>

      {/* Play/pause video toggle */}
      {hasVideo && (() => {
        if (!timestamp) return <span className="shrink-0 w-5" />;
        const isThisSectionPlaying = playingSectionId === section.id;
        return (
          <button
            onClick={() => {
              if (isThisSectionPlaying) {
                video.pause();
              } else {
                video.seekTo(timestamp.start_seconds);
                video.play();
              }
            }}
            className={cn(
              "shrink-0 w-5 h-5 flex items-center justify-center cursor-pointer transition-colors rounded hover:bg-muted",
              isThisSectionPlaying
                ? "text-primary"
                : "text-muted-foreground/40 hover:text-foreground"
            )}
          >
            {isThisSectionPlaying ? (
              <PauseIcon className="size-3.5" />
            ) : (
              <PlayIcon className="size-3.5" />
            )}
          </button>
        );
      })()}

      {/* Tempo */}
      {editingTempo ? (
        <Input
          type="number"
          value={tempoValue}
          onChange={(e) => setTempoValue(e.target.value)}
          onBlur={handleSaveTempo}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveTempo();
            if (e.key === "Escape") {
              setEditingTempo(false);
              setTempoValue(String(section.target_tempo ?? ""));
            }
          }}
          className="w-16 h-6 text-xs"
          autoFocus
          min={20}
          max={300}
          placeholder={effectiveTempo ? String(effectiveTempo) : "—"}
        />
      ) : (
        <button
          onClick={() => {
            setTempoValue(String(section.target_tempo ?? ""));
            setEditingTempo(true);
          }}
          className={cn(
            "text-xs font-mono tabular-nums px-1 py-0.5 rounded hover:bg-muted transition-colors",
            section.target_tempo ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {section.target_tempo
            ? `♩ ${section.target_tempo}`
            : effectiveTempo
              ? `♩ ${effectiveTempo}`
              : "—"}
        </button>
      )}

      {/* Timestamp (only when video exists) */}
      {hasVideo && (
        <div className="flex items-center gap-1 ml-auto">
          <Input
            value={tsValue}
            onChange={(e) => setTsValue(e.target.value)}
            onBlur={handleBlurTimestamp}
            placeholder="—"
            className="h-6 w-14 text-xs font-mono text-center"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleMark}
            className="h-6 text-xs px-1.5"
          >
            Mark
          </Button>
        </div>
      )}

      {/* Spacer when no video */}
      {!hasVideo && <div className="flex-1" />}

      {/* Delete */}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Video boundary row (Start / End)                                   */
/* ------------------------------------------------------------------ */

function VideoBoundaryRow({
  label,
  video,
  field,
  onUpdated,
}: {
  label: string;
  video: PieceVideo;
  field: "start" | "end";
  onUpdated: () => void;
}) {
  const { currentTime } = useVideo();
  const seconds = field === "start" ? video.start_seconds : video.end_seconds;
  const [value, setValue] = useState(formatMMSS(seconds));

  useEffect(() => {
    setValue(formatMMSS(field === "start" ? video.start_seconds : video.end_seconds));
  }, [video.start_seconds, video.end_seconds, field]);

  const save = async (val: number | null) => {
    if (field === "start") {
      await updateVideoTimeRange(video.id, val, video.end_seconds);
    } else {
      await updateVideoTimeRange(video.id, video.start_seconds, val);
    }
    onUpdated();
  };

  const handleMark = () => {
    const rounded = field === "start" ? Math.floor(currentTime) : Math.ceil(currentTime);
    setValue(formatMMSS(rounded));
    save(rounded);
  };

  const handleBlur = () => {
    save(parseMMSS(value));
  };

  return (
    <div className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 transition-colors">
      <span className="text-sm font-medium min-w-[2rem] text-muted-foreground italic">
        {label}
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          placeholder={field === "start" ? "0:00" : "end"}
          className="h-6 w-14 text-xs font-mono text-center"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleMark}
          className="h-6 text-xs px-1.5"
        >
          Mark
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function SectionEditor({
  pieceId,
  pieceTargetTempo,
  initialSections,
  initialVideos,
  initialTimestamps,
}: {
  pieceId: string;
  pieceTargetTempo: number | null;
  initialSections: PieceSectionWithChildren[];
  initialVideos: PieceVideo[];
  initialTimestamps: PieceSectionTimestamp[];
}) {
  const videoCtx = useVideo();
  const [sections, setSections] = useState(initialSections);
  const [targetTempo, setTargetTempo] = useState(pieceTargetTempo);
  const [editingTempo, setEditingTempo] = useState(false);
  const [tempoValue, setTempoValue] = useState(
    String(pieceTargetTempo ?? "")
  );

  const [videos, setVideos] = useState(initialVideos);
  const [timestamps, setTimestamps] = useState(initialTimestamps);
  const activeVideo = videos[0] ?? null;
  const hasVideo = activeVideo !== null;

  // Video URL input
  const [videoUrl, setVideoUrl] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);

  // Determine which section is currently playing
  const playingSectionId = (() => {
    if (!videoCtx.isPlaying) return null;
    let best: { sectionId: string; start: number } | null = null;
    for (const ts of timestamps) {
      if (ts.start_seconds <= videoCtx.currentTime) {
        if (!best || ts.start_seconds > best.start) {
          best = { sectionId: ts.section_id, start: ts.start_seconds };
        }
      }
    }
    return best?.sectionId ?? null;
  })();

  // Load video into context when component mounts / video changes
  useEffect(() => {
    if (activeVideo) {
      videoCtx.setVideo(
        activeVideo.youtube_video_id,
        activeVideo.start_seconds,
        activeVideo.end_seconds
      );
    }
    return () => {
      videoCtx.clearVideo();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideo?.id]);

  const refreshSections = useCallback(async () => {
    const newSections = await getSections(pieceId);
    setSections(newSections);
  }, [pieceId]);

  const refreshVideo = useCallback(async () => {
    const newVideos = await getVideos(pieceId);
    setVideos(newVideos);
    if (newVideos[0]) {
      const newTimestamps = await getTimestamps(newVideos[0].id);
      setTimestamps(newTimestamps);
      videoCtx.setVideo(
        newVideos[0].youtube_video_id,
        newVideos[0].start_seconds,
        newVideos[0].end_seconds
      );
    } else {
      setTimestamps([]);
      videoCtx.clearVideo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceId]);

  const refreshTimestamps = useCallback(async () => {
    if (!activeVideo) return;
    const newTimestamps = await getTimestamps(activeVideo.id);
    setTimestamps(newTimestamps);
  }, [activeVideo]);

  // Listen for cross-component section changes
  useEffect(() => {
    const handler = () => refreshSections();
    window.addEventListener("sections-changed", handler);
    return () => window.removeEventListener("sections-changed", handler);
  }, [refreshSections]);

  // Optimistically apply status changes from other components (e.g. scrubber bar)
  useEffect(() => {
    const handler = (e: Event) => {
      const { sectionId, status } = (e as CustomEvent).detail;
      setSections((prev) =>
        prev.map((s) => {
          if (s.id === sectionId) return { ...s, status };
          return {
            ...s,
            children: s.children.map((c) =>
              c.id === sectionId ? { ...c, status } : c
            ),
          };
        })
      );
    };
    window.addEventListener("section-status-changed", handler);
    return () => window.removeEventListener("section-status-changed", handler);
  }, []);

  const dispatchSectionsChanged = () => {
    window.dispatchEvent(new CustomEvent("sections-changed"));
  };

  /* -- Section actions -- */

  const handleAddSection = async () => {
    const label = nextSectionLetter(sections);
    await createSection(pieceId, label);
    await refreshSections();
    dispatchSectionsChanged();
  };

  const handleAddSubsection = async (parent: PieceSectionWithChildren) => {
    if (parent.children.length === 0) {
      // First subsection: create A1 (inherits parent data) and A2 (blank)
      const result1 = await createSection(pieceId, `${parent.label}1`, parent.id);
      if (result1.success && result1.id) {
        // Copy parent's status and tempo to A1
        if (parent.status !== 0) {
          await updateSectionStatus(result1.id, parent.status as SectionStatus, { pieceId, skipSnapshot: true });
        }
        if (parent.target_tempo !== null) {
          await updateSectionTargetTempo(result1.id, parent.target_tempo);
        }
        // Copy parent's timestamp to A1 if one exists
        const parentTs = timestamps.find((t) => t.section_id === parent.id);
        if (parentTs && activeVideo) {
          await upsertTimestamp(result1.id, activeVideo.id, parentTs.start_seconds, null);
        }
      }
      await createSection(pieceId, `${parent.label}2`, parent.id);
    } else {
      const label = nextSubsectionLabel(parent);
      await createSection(pieceId, label, parent.id);
    }
    await refreshSections();
    if (hasVideo) await refreshTimestamps();
    dispatchSectionsChanged();
  };

  const handleDelete = async (sectionId: string) => {
    // Optimistic update
    setSections((prev) =>
      prev
        .filter((s) => s.id !== sectionId)
        .map((s) => ({
          ...s,
          children: s.children.filter((c) => c.id !== sectionId),
        }))
    );
    await deleteSection(sectionId);

    // Refresh and check for auto-collapse
    const newSections = await getSections(pieceId);
    for (const parent of newSections) {
      if (parent.children.length === 1) {
        const remaining = parent.children[0];
        // Copy child's data to parent
        await updateSectionStatus(parent.id, remaining.status as SectionStatus, { pieceId, skipSnapshot: true });
        await updateSectionTargetTempo(parent.id, remaining.target_tempo);
        // Copy timestamp if exists
        if (activeVideo) {
          const childTs = timestamps.find((t) => t.section_id === remaining.id);
          if (childTs) {
            await upsertTimestamp(parent.id, activeVideo.id, childTs.start_seconds, null);
          }
        }
        // Delete the remaining child
        await deleteSection(remaining.id);
      }
    }

    await refreshSections();
    if (hasVideo) await refreshTimestamps();
    dispatchSectionsChanged();
  };

  const handleStatusCycle = (section: PieceSection) => {
    const next = ((section.status + 1) % 9) as SectionStatus;
    setSections((prev) =>
      prev.map((s) => {
        if (s.id === section.id) return { ...s, status: next };
        return {
          ...s,
          children: s.children.map((c) =>
            c.id === section.id ? { ...c, status: next } : c
          ),
        };
      })
    );
    updateSectionStatus(section.id, next, { pieceId });
    window.dispatchEvent(new CustomEvent("section-status-changed", { detail: { sectionId: section.id, status: next } }));
  };

  const handleTempoChange = (section: PieceSection, tempo: number | null) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id === section.id) return { ...s, target_tempo: tempo };
        return {
          ...s,
          children: s.children.map((c) =>
            c.id === section.id ? { ...c, target_tempo: tempo } : c
          ),
        };
      })
    );
    updateSectionTargetTempo(section.id, tempo);
    dispatchSectionsChanged();
  };

  const handleSavePieceTempo = () => {
    setEditingTempo(false);
    const parsed = tempoValue.trim() ? parseInt(tempoValue, 10) : null;
    const value = parsed && !isNaN(parsed) ? parsed : null;
    setTargetTempo(value);
    updatePieceTargetTempo(pieceId, value);
    dispatchSectionsChanged();
  };

  /* -- Video actions -- */

  const handleAddVideo = async () => {
    const vid = extractVideoId(videoUrl);
    if (!vid) return;
    setAddingVideo(true);
    await createVideo(pieceId, vid);
    setVideoUrl("");
    setAddingVideo(false);
    await refreshVideo();
  };

  const handleDeleteVideo = async () => {
    if (!activeVideo) return;
    await deleteVideo(activeVideo.id);
    await refreshVideo();
  };

  return (
    <div className="space-y-4">
      {/* Header: title + piece target tempo */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Sections</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Target tempo:</span>
          {editingTempo ? (
            <Input
              type="number"
              value={tempoValue}
              onChange={(e) => setTempoValue(e.target.value)}
              onBlur={handleSavePieceTempo}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePieceTempo();
                if (e.key === "Escape") {
                  setEditingTempo(false);
                  setTempoValue(String(targetTempo ?? ""));
                }
              }}
              className="w-20 h-7 text-xs"
              autoFocus
              min={20}
              max={300}
            />
          ) : (
            <button
              onClick={() => {
                setTempoValue(String(targetTempo ?? ""));
                setEditingTempo(true);
              }}
              className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
            >
              {targetTempo ? `♩ ${targetTempo}` : "Set..."}
            </button>
          )}
        </div>
      </div>

      {/* Video panel */}
      {hasVideo ? (
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteVideo}
              className="h-7 text-xs text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2Icon className="size-3 mr-1" />
              Remove video
            </Button>
          </div>
          <YouTubePlayer />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="YouTube URL or video ID"
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddVideo();
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddVideo}
            disabled={addingVideo || !extractVideoId(videoUrl)}
            className="h-8"
          >
            <PlusIcon className="size-3.5 mr-1" />
            Add Video
          </Button>
        </div>
      )}

      {/* Section rows — flat list with video boundary rows */}
      {(() => {
        const flatRows = buildFlatRows(sections);
        return (
          <div>
            {/* Video start boundary */}
            {hasVideo && (
              <VideoBoundaryRow
                label="Start"
                video={activeVideo}
                field="start"
                onUpdated={refreshVideo}
              />
            )}

            {flatRows.map((row) => {
              const insertParent = row.parent;
              return (
                <div key={row.section.id}>
                  <SectionRow
                    section={row.section}
                    pieceTargetTempo={targetTempo}
                    hasVideo={hasVideo}
                    videoId={activeVideo?.id ?? null}
                    timestamp={timestamps.find(
                      (t) => t.section_id === row.section.id
                    )}
                    playingSectionId={playingSectionId}
                    onStatusCycle={() => handleStatusCycle(row.section)}
                    onDelete={() => handleDelete(row.section.id)}
                    onTempoChange={(tempo) =>
                      handleTempoChange(row.section, tempo)
                    }
                    onTimestampUpdated={refreshTimestamps}
                  />
                  <GutterInsert
                    onClick={() => handleAddSubsection(insertParent)}
                  />
                </div>
              );
            })}

            {/* Video end boundary */}
            {hasVideo && (
              <VideoBoundaryRow
                label="End"
                video={activeVideo}
                field="end"
                onUpdated={refreshVideo}
              />
            )}
          </div>
        );
      })()}

      {/* Add section button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleAddSection}
      >
        <PlusIcon className="size-3.5 mr-1" />
        Add Section
      </Button>
    </div>
  );
}
