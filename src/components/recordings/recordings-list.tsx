"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  PlayIcon,
  PauseIcon,
  MoreVerticalIcon,
  Trash2Icon,
  DownloadIcon,
  Scissors,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronDownIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Recording } from "@/app/(app)/recordings/actions";
import {
  createSignedPlaybackUrl,
  deleteTaskAudio,
  updateTaskAudioTitle,
} from "@/app/(app)/timer/audio-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TaskAudioDialog,
  formatNotesDefault,
} from "@/components/practice-table/task-audio-dialog";
import { RecordingsPlayerBar } from "@/components/recordings/recordings-player-bar";

type SortKey = "piece" | "time" | "composer" | "group" | "notes" | "date";
type SortDir = "asc" | "desc";

const GENERAL_KEY = "__general__";

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function comparatorFor(key: SortKey): (a: Recording, b: Recording) => number {
  const str = (v: string | null | undefined) => (v ?? "").toLocaleLowerCase();
  switch (key) {
    case "piece":
      return (a, b) =>
        str(a.pieceName ?? "General").localeCompare(str(b.pieceName ?? "General"));
    case "time":
      return (a, b) => a.durationSeconds - b.durationSeconds;
    case "composer":
      return (a, b) => str(a.pieceComposer).localeCompare(str(b.pieceComposer));
    case "group":
      return (a, b) =>
        str(a.workName).localeCompare(str(b.workName));
    case "notes":
      return (a, b) => str(a.audioTitle).localeCompare(str(b.audioTitle));
    case "date":
      return (a, b) => a.createdAt.localeCompare(b.createdAt);
  }
}

function buildDownloadFilename(rec: Recording): string {
  const parts = rec.audioTitle
    ? [rec.audioTitle, rec.date]
    : [rec.pieceName ?? "General", rec.sectionLabel, rec.date];
  const raw = (parts.filter(Boolean) as string[]).join(" - ");
  return raw.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

export function RecordingsList({ initial }: { initial: Recording[] }) {
  const [recordings, setRecordings] = useState<Recording[]>(initial);
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimDialogTaskId, setTrimDialogTaskId] = useState<string | null>(null);

  type PieceOption = { key: string; label: string; workName: string | null };
  type MenuEntry =
    | { kind: "piece"; option: PieceOption }
    | { kind: "work"; name: string; options: PieceOption[] };

  const pieceOptions = useMemo<PieceOption[]>(() => {
    const seen = new Map<string, PieceOption>();
    for (const rec of recordings) {
      const key = rec.pieceName ?? GENERAL_KEY;
      if (seen.has(key)) continue;
      seen.set(key, {
        key,
        label: rec.pieceName ?? "General",
        workName: rec.pieceName ? rec.workName : null,
      });
    }
    return Array.from(seen.values());
  }, [recordings]);

  const menuEntries = useMemo<MenuEntry[]>(() => {
    const byWork = new Map<string, PieceOption[]>();
    for (const opt of pieceOptions) {
      if (!opt.workName) continue;
      const list = byWork.get(opt.workName) ?? [];
      list.push(opt);
      byWork.set(opt.workName, list);
    }
    const entries: MenuEntry[] = [];
    const seenWorks = new Set<string>();
    for (const opt of pieceOptions) {
      const work = opt.workName;
      const workOptions = work
        ? byWork.get(work)
        : undefined;
      if (work && workOptions && workOptions.length > 1) {
        if (seenWorks.has(work)) continue;
        seenWorks.add(work);
        entries.push({
          kind: "work",
          name: work,
          options: workOptions,
        });
      } else {
        entries.push({ kind: "piece", option: opt });
      }
    }
    return entries;
  }, [pieceOptions]);

  const visible = useMemo(() => {
    const filtered = filterKey
      ? recordings.filter(
          (r) => (r.pieceName ?? GENERAL_KEY) === filterKey
        )
      : recordings;
    const cmp = comparatorFor(sortKey);
    const sorted = [...filtered].sort(cmp);
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [recordings, filterKey, sortKey, sortDir]);

  const currentRecording = useMemo(
    () => recordings.find((r) => r.taskId === currentTaskId) ?? null,
    [recordings, currentTaskId]
  );

  const trimDialogRec = useMemo(
    () => recordings.find((r) => r.taskId === trimDialogTaskId) ?? null,
    [recordings, trimDialogTaskId]
  );

  const handlePlayRow = useCallback(
    (rec: Recording) => {
      if (currentTaskId === rec.taskId) {
        setIsPlaying((p) => !p);
        return;
      }
      setCurrentTaskId(rec.taskId);
      setIsPlaying(true);
    },
    [currentTaskId]
  );

  const handleTitleSaved = useCallback(
    (taskId: string, nextTitle: string | null) => {
      setRecordings((prev) =>
        prev.map((r) =>
          r.taskId === taskId ? { ...r, audioTitle: nextTitle } : r
        )
      );
    },
    []
  );

  const handleDeleted = useCallback(
    (taskId: string) => {
      setRecordings((prev) => prev.filter((r) => r.taskId !== taskId));
      if (currentTaskId === taskId) {
        setCurrentTaskId(null);
        setIsPlaying(false);
      }
    },
    [currentTaskId]
  );

  const handleTrimUpdated = useCallback(
    (taskId: string, start: number | null, end: number | null) => {
      setRecordings((prev) =>
        prev.map((r) =>
          r.taskId === taskId
            ? { ...r, trimStartSeconds: start, trimEndSeconds: end }
            : r
        )
      );
    },
    []
  );

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDir(key === "date" || key === "time" ? "desc" : "asc");
        return;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    },
    [sortKey]
  );

  if (recordings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No recordings yet. Record one from a task in the Practice Log.
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {pieceOptions.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                filterKey
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {pieceOptions.find((opt) => opt.key === filterKey)?.label ??
                "Pieces"}
              <ChevronDownIcon className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80">
              {menuEntries.map((entry) =>
                entry.kind === "piece" ? (
                  <DropdownMenuItem
                    key={entry.option.key}
                    onClick={() =>
                      setFilterKey((prev) =>
                        prev === entry.option.key ? null : entry.option.key
                      )
                    }
                    className={cn(filterKey === entry.option.key && "bg-accent")}
                  >
                    {entry.option.label}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuSub key={`work:${entry.name}`}>
                    <DropdownMenuSubTrigger
                      className={cn(
                        entry.options.some((opt) => opt.key === filterKey) &&
                          "bg-accent"
                      )}
                    >
                      {entry.name}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {entry.options.map((opt) => (
                        <DropdownMenuItem
                          key={opt.key}
                          onClick={() =>
                            setFilterKey((prev) =>
                              prev === opt.key ? null : opt.key
                            )
                          }
                          className={cn(filterKey === opt.key && "bg-accent")}
                        >
                          {opt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No recordings for this piece.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10" />
                  <SortHeader
                    label="Piece"
                    active={sortKey === "piece"}
                    dir={sortDir}
                    onClick={() => toggleSort("piece")}
                  />
                  <SortHeader
                    label="Time"
                    active={sortKey === "time"}
                    dir={sortDir}
                    onClick={() => toggleSort("time")}
                    className="w-20"
                  />
                  <SortHeader
                    label="Composer"
                    active={sortKey === "composer"}
                    dir={sortDir}
                    onClick={() => toggleSort("composer")}
                  />
                  <SortHeader
                    label="Group"
                    active={sortKey === "group"}
                    dir={sortDir}
                    onClick={() => toggleSort("group")}
                  />
                  <SortHeader
                    label="Notes"
                    active={sortKey === "notes"}
                    dir={sortDir}
                    onClick={() => toggleSort("notes")}
                  />
                  <SortHeader
                    label="Date"
                    active={sortKey === "date"}
                    dir={sortDir}
                    onClick={() => toggleSort("date")}
                    className="w-32"
                  />
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {visible.map((rec) => {
                  const isCurrent = rec.taskId === currentTaskId;
                  const showPause = isCurrent && isPlaying;
                  return (
                    <tr
                      key={rec.taskId}
                      className={cn(
                        "border-t transition-colors",
                        isCurrent
                          ? "bg-primary/5"
                          : "hover:bg-muted/30"
                      )}
                    >
                      <td className="px-2 py-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handlePlayRow(rec)}
                          aria-label={showPause ? "Pause" : "Play"}
                          title={showPause ? "Pause" : "Play"}
                        >
                          {showPause ? <PauseIcon /> : <PlayIcon />}
                        </Button>
                      </td>
                      <td className="px-3 py-2 truncate max-w-[14rem]">
                        {rec.pieceName ?? (
                          <span className="text-muted-foreground">General</span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {formatDuration(rec.durationSeconds)}
                      </td>
                      <td className="px-3 py-2 truncate max-w-[12rem] text-muted-foreground">
                        {rec.pieceComposer ?? ""}
                      </td>
                      <td className="px-3 py-2 truncate max-w-[12rem] text-muted-foreground">
                        {rec.workName ?? ""}
                      </td>
                      <td className="px-3 py-2 max-w-[16rem]">
                        <NotesCell
                          rec={rec}
                          onSaved={(t) => handleTitleSaved(rec.taskId, t)}
                        />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {formatDate(rec.date)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <RowMenu
                          rec={rec}
                          onDeleted={() => handleDeleted(rec.taskId)}
                          onEditTrim={() => setTrimDialogTaskId(rec.taskId)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <ul className="md:hidden space-y-2">
            {visible.map((rec) => {
              const isCurrent = rec.taskId === currentTaskId;
              const showPause = isCurrent && isPlaying;
              return (
                <li
                  key={rec.taskId}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    isCurrent ? "border-primary/60 bg-primary/5" : "bg-card"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => handlePlayRow(rec)}
                      aria-label={showPause ? "Pause" : "Play"}
                      title={showPause ? "Pause" : "Play"}
                    >
                      {showPause ? <PauseIcon /> : <PlayIcon />}
                    </Button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {rec.pieceName ?? "General"}
                      </div>
                      <NotesCell
                        rec={rec}
                        onSaved={(t) => handleTitleSaved(rec.taskId, t)}
                      />
                    </div>
                    <RowMenu
                      rec={rec}
                      onDeleted={() => handleDeleted(rec.taskId)}
                      onEditTrim={() => setTrimDialogTaskId(rec.taskId)}
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {rec.pieceComposer && (
                      <span className="truncate">{rec.pieceComposer}</span>
                    )}
                    {rec.workName && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">{rec.workName}</span>
                      </>
                    )}
                    <span aria-hidden>·</span>
                    <span className="whitespace-nowrap">
                      {formatDate(rec.date)}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums whitespace-nowrap">
                      {formatDuration(rec.durationSeconds)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <RecordingsPlayerBar
        recording={currentRecording}
        isPlaying={isPlaying}
        onPlayingChange={setIsPlaying}
        onClose={() => {
          setCurrentTaskId(null);
          setIsPlaying(false);
        }}
      />

      {trimDialogRec && (
        <TaskAudioDialog
          taskId={trimDialogRec.taskId}
          open={trimDialogTaskId !== null}
          onOpenChange={(open) => {
            if (!open) setTrimDialogTaskId(null);
          }}
          initialMode="playback"
          existingAudioPath={trimDialogRec.audioPath}
          existingDurationSeconds={trimDialogRec.durationSeconds}
          existingTrimStartSeconds={trimDialogRec.trimStartSeconds}
          existingTrimEndSeconds={trimDialogRec.trimEndSeconds}
          existingAudioTitle={trimDialogRec.audioTitle}
          pieceName={trimDialogRec.pieceName}
          sectionLabel={trimDialogRec.sectionLabel}
          taskText={trimDialogRec.taskText}
          onTrimUpdated={(start, end) =>
            handleTrimUpdated(trimDialogRec.taskId, start, end)
          }
          onTitleUpdated={(title) =>
            handleTitleSaved(trimDialogRec.taskId, title)
          }
          onDeleted={() => handleDeleted(trimDialogRec.taskId)}
        />
      )}
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={cn("px-3 py-2 text-left font-medium", className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 text-xs uppercase tracking-wide",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span>{label}</span>
        {active &&
          (dir === "asc" ? (
            <ArrowUpIcon className="size-3" />
          ) : (
            <ArrowDownIcon className="size-3" />
          ))}
      </button>
    </th>
  );
}

function recordingDefaultTitle(rec: Recording): string {
  return formatNotesDefault(rec.sectionLabel, rec.taskText);
}

function NotesCell({
  rec,
  onSaved,
}: {
  rec: Recording;
  onSaved: (nextTitle: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultTitle = recordingDefaultTitle(rec);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(rec.audioTitle ?? "");
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
      onSaved(next);
    } catch {
      // Leave local state alone; user can retry.
    } finally {
      setSaving(false);
    }
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
            setEditing(false);
          }
        }}
        placeholder={defaultTitle || "Add a note"}
        aria-label="Recording note"
        className="-mx-1 w-full rounded-sm bg-transparent px-1 text-sm outline-none ring-1 ring-ring/40 focus:ring-ring"
      />
    );
  }

  const display = rec.audioTitle;
  return (
    <button
      type="button"
      onClick={startEditing}
      disabled={saving}
      title="Edit note"
      className={cn(
        "-mx-1 block w-full truncate rounded-sm px-1 text-left hover:bg-muted/60 disabled:opacity-60",
        display ? "text-foreground" : "text-muted-foreground italic"
      )}
    >
      {display || "Add a note"}
    </button>
  );
}

function RowMenu({
  rec,
  onDeleted,
  onEditTrim,
}: {
  rec: Recording;
  onDeleted: () => void;
  onEditTrim: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const onDownload = async () => {
    setOpen(false);
    try {
      const signedUrl = await createSignedPlaybackUrl(rec.audioPath);
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const basename = rec.audioPath.split("/").pop() ?? "recording";
      const ext = basename.includes(".") ? basename.split(".").pop()! : "webm";
      const name = buildDownloadFilename(rec)
        ? `${buildDownloadFilename(rec)}.${ext}`
        : basename;
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Silent — surfacing this in the row UI would be noisy.
    }
  };

  const onDelete = async () => {
    setOpen(false);
    try {
      await deleteTaskAudio(rec.taskId);
      onDeleted();
    } catch {
      // No-op; UI stays as-is.
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((o) => !o)}
        aria-label="Recording options"
      >
        <MoreVerticalIcon />
      </Button>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuContent
          anchor={triggerRef}
          align="end"
          side="bottom"
          className="w-40"
        >
          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              onEditTrim();
            }}
          >
            <Scissors />
            Edit trim
          </DropdownMenuItem>
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
    </>
  );
}

