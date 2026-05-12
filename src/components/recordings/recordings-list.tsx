"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RecordingPlayer } from "@/components/recordings/recording-player";
import { cn } from "@/lib/utils";
import type { Recording } from "@/app/(app)/recordings/actions";
import { updateTaskAudioTitle } from "@/app/(app)/timer/audio-actions";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type PieceOption = {
  key: string;
  label: string;
};

const GENERAL_KEY = "__general__";

export function RecordingsList({ initial }: { initial: Recording[] }) {
  const [recordings, setRecordings] = useState<Recording[]>(initial);
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initial[0]?.taskId ?? null
  );

  const pieceOptions = useMemo<PieceOption[]>(() => {
    const seen = new Map<string, string>();
    for (const rec of recordings) {
      const key = rec.pieceName ?? GENERAL_KEY;
      const label = rec.pieceName ?? "General";
      if (!seen.has(key)) seen.set(key, label);
    }
    return Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
  }, [recordings]);

  const filtered = useMemo(() => {
    if (!filterKey) return recordings;
    return recordings.filter(
      (rec) => (rec.pieceName ?? GENERAL_KEY) === filterKey
    );
  }, [recordings, filterKey]);

  const grouped = useMemo(() => {
    const map = new Map<string, Recording[]>();
    for (const rec of filtered) {
      if (!map.has(rec.date)) map.set(rec.date, []);
      map.get(rec.date)!.push(rec);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Keep selection inside the currently visible set.
  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedTaskId !== null) setSelectedTaskId(null);
      return;
    }
    if (selectedTaskId && filtered.some((r) => r.taskId === selectedTaskId)) {
      return;
    }
    setSelectedTaskId(filtered[0].taskId);
  }, [filtered, selectedTaskId]);

  if (recordings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No recordings yet. Record one from a task in the Practice Log.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pieceOptions.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <FilterPill
            active={filterKey === null}
            onClick={() => setFilterKey(null)}
          >
            All
          </FilterPill>
          {pieceOptions.map((opt) => (
            <FilterPill
              key={opt.key}
              active={filterKey === opt.key}
              onClick={() =>
                setFilterKey((prev) => (prev === opt.key ? null : opt.key))
              }
            >
              {opt.label}
            </FilterPill>
          ))}
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No recordings for this piece.
        </div>
      ) : (
        grouped.map(([date, items]) => (
          <section key={date}>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              {formatDate(date)}
            </h3>
            <ul className="space-y-3">
              {items.map((rec) => {
                const isSelected = rec.taskId === selectedTaskId;
                return (
                  <li
                    key={rec.taskId}
                    onClick={() => setSelectedTaskId(rec.taskId)}
                    className={cn(
                      "cursor-pointer rounded-lg border bg-card p-4 space-y-3 transition-[box-shadow,border-color]",
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : "hover:border-muted-foreground/40"
                    )}
                  >
                    <div className="min-w-0">
                      <RecordingTitle
                        rec={rec}
                        onTitleSaved={(nextTitle) =>
                          setRecordings((prev) =>
                            prev.map((r) =>
                              r.taskId === rec.taskId
                                ? { ...r, audioTitle: nextTitle }
                                : r
                            )
                          )
                        }
                      />
                      {rec.taskText && (
                        <div className="truncate text-xs text-muted-foreground">
                          {rec.taskText}
                        </div>
                      )}
                    </div>
                    <RecordingPlayer
                      taskId={rec.taskId}
                      audioPath={rec.audioPath}
                      initialDuration={rec.durationSeconds}
                      trimStartSeconds={rec.trimStartSeconds}
                      trimEndSeconds={rec.trimEndSeconds}
                      selected={isSelected}
                      downloadFilename={buildDownloadFilename(rec)}
                      onDeleted={() =>
                        setRecordings((prev) =>
                          prev.filter((r) => r.taskId !== rec.taskId)
                        )
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function recordingDefaultTitle(rec: Recording): string {
  return [rec.pieceName, rec.sectionLabel].filter(Boolean).join(" — ");
}

function RecordingTitle({
  rec,
  onTitleSaved,
}: {
  rec: Recording;
  onTitleSaved: (nextTitle: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultTitle = recordingDefaultTitle(rec);
  const displayPrimary = rec.audioTitle ?? rec.pieceName ?? "General";
  const secondary = buildSecondary(rec);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(rec.audioTitle ?? defaultTitle);
    setEditing(true);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  };

  const commit = async () => {
    const trimmed = value.trim();
    const next = trimmed ? trimmed : null;
    setEditing(false);
    if (next === (rec.audioTitle ?? null)) return;
    setSaving(true);
    try {
      await updateTaskAudioTitle(rec.taskId, next);
      onTitleSaved(next);
    } catch {
      // Leave local state alone; user can retry by clicking again.
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cancel();
          }
        }}
        placeholder={defaultTitle || "Recording"}
        aria-label="Recording title"
        className="-mx-1 w-full rounded-sm bg-transparent px-1 text-sm font-medium leading-tight outline-none ring-1 ring-ring/40 focus:ring-ring"
      />
    );
  }

  return (
    <div className="truncate text-sm font-medium">
      <button
        type="button"
        onClick={startEditing}
        disabled={saving}
        title="Rename recording"
        className="-mx-1 rounded-sm px-1 text-left hover:bg-muted/60 disabled:opacity-60"
      >
        {displayPrimary}
      </button>
      {secondary && (
        <span className="font-normal text-muted-foreground">
          {" · "}
          {secondary}
        </span>
      )}
    </div>
  );
}

function buildSecondary(rec: Recording): string {
  const parts: string[] = [];
  if (rec.audioTitle && rec.pieceName) parts.push(rec.pieceName);
  if (!rec.audioTitle && rec.sectionLabel) parts.push(rec.sectionLabel);
  if (rec.pieceComposer) parts.push(rec.pieceComposer);
  if (rec.collectionName) parts.push(rec.collectionName);
  return parts.join(" · ");
}

function buildDownloadFilename(rec: Recording): string {
  const parts = rec.audioTitle
    ? [rec.audioTitle, rec.date]
    : [rec.pieceName ?? "General", rec.sectionLabel, rec.date];
  const raw = (parts.filter(Boolean) as string[]).join(" - ");
  return raw.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
