"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import {
  getLessonsByDate,
  createLessonBatch,
  addLessonEntryForPiece,
  updateLessonEntry,
  deleteLessonEntry,
} from "@/app/(app)/lessons/actions";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { formatMinutes } from "@/lib/timer-utils";
import type { LessonDay, LessonEntryWithPiece, Piece } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

function StatPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs tabular-nums font-medium whitespace-nowrap">
      {children}
    </span>
  );
}

function LessonEntryRow({
  entry,
  pieceSeconds,
  dayCount,
  onDelete,
}: {
  entry: LessonEntryWithPiece;
  pieceSeconds: number;
  dayCount: number;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(entry.notes);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNotes(entry.notes);
  }, [entry.notes]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [notes]);

  const handleBlur = () => {
    if (notes !== entry.notes) {
      void updateLessonEntry(entry.id, { notes });
    }
  };

  const label = entry.piece_name ?? "General";
  const perDay = dayCount > 0 && pieceSeconds > 0
    ? Math.round(pieceSeconds / dayCount)
    : 0;

  return (
    <div className="group flex items-start gap-3 py-2 border-b border-border/40 last:border-b-0">
      <div className="w-40 shrink-0 pt-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">
            {label}
          </span>
        </div>
        {entry.piece_composer && (
          <div className="text-xs text-muted-foreground truncate">
            {entry.piece_composer}
          </div>
        )}
        {pieceSeconds > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            <StatPill>{formatMinutes(pieceSeconds)}</StatPill>
            {perDay > 0 && <StatPill>{formatMinutes(perDay)}/day</StatPill>}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleBlur}
          rows={1}
          placeholder="Notes..."
          className={cn(
            "w-full bg-transparent focus:outline-none resize-none text-sm leading-relaxed overflow-hidden",
            "text-foreground placeholder:text-muted-foreground/60"
          )}
        />
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 mt-1"
        title="Delete entry"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}

function LessonDayCard({
  day,
  pieceOrder,
  activePieces,
  onDelete,
  onAddPiece,
}: {
  day: LessonDay;
  pieceOrder: Map<string, number>;
  activePieces: Piece[];
  onDelete: (id: string) => void;
  onAddPiece: (pieceId: string, date: string) => void;
}) {
  const { totalSeconds, dayCount, calendarDays, entries: summaryEntries } = day.timeSummary;
  const perDay = dayCount > 0 && totalSeconds > 0
    ? Math.round(totalSeconds / dayCount)
    : 0;
  const secondsByPiece = new Map<string, number>();
  for (const e of summaryEntries) secondsByPiece.set(e.piece_id, e.total_seconds);

  const sortedEntries = [...day.entries].sort((a, b) => {
    if (a.piece_id === null && b.piece_id !== null) return -1;
    if (b.piece_id === null && a.piece_id !== null) return 1;
    if (a.piece_id === null && b.piece_id === null) return 0;
    const ai = pieceOrder.get(a.piece_id!) ?? Number.MAX_SAFE_INTEGER;
    const bi = pieceOrder.get(b.piece_id!) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return (a.piece_name ?? "").localeCompare(b.piece_name ?? "");
  });

  const existingPieceIds = new Set(
    day.entries.map((e) => e.piece_id).filter((id): id is string => id !== null)
  );
  const addablePieces = activePieces.filter((p) => !existingPieceIds.has(p.id));

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h2 className="text-lg font-semibold text-foreground">
          {formatDate(day.date)}
        </h2>
        {totalSeconds > 0 && (
          <>
            <StatPill>{formatMinutes(totalSeconds)}</StatPill>
            {perDay > 0 && <StatPill>{formatMinutes(perDay)}/day</StatPill>}
            <StatPill>
              Practiced {dayCount} of {calendarDays} days
            </StatPill>
          </>
        )}
        {addablePieces.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="ml-auto inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground size-7 transition-colors"
              title="Add active repertoire"
            >
              <PlusIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {addablePieces.map((piece) => (
                <DropdownMenuItem
                  key={piece.id}
                  onClick={() => onAddPiece(piece.id, day.date)}
                >
                  <div className="flex flex-col">
                    <span className="text-sm">{piece.name}</span>
                    {piece.composer && (
                      <span className="text-xs text-muted-foreground">
                        {piece.composer}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="rounded-lg border bg-card px-4">
        {sortedEntries.map((entry) => {
          const key = entry.piece_id ?? "__general__";
          const pieceSeconds = secondsByPiece.get(key) ?? 0;
          return (
            <LessonEntryRow
              key={entry.id}
              entry={entry}
              pieceSeconds={pieceSeconds}
              dayCount={dayCount}
              onDelete={() => onDelete(entry.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function LessonsList({
  initialData,
}: {
  initialData: { items: LessonDay[]; nextCursor: string | null };
}) {
  const { activePieces } = useTaskTimer();
  const [days, setDays] = useState<LessonDay[]>(initialData.items);
  const [cursor, setCursor] = useState<string | null>(initialData.nextCursor);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setDays(initialData.items);
    setCursor(initialData.nextCursor);
  }, [initialData]);

  const refresh = useCallback(async () => {
    const result = await getLessonsByDate(undefined, Math.max(days.length, 10));
    setDays(result.items);
    setCursor(result.nextCursor);
  }, [days.length]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const result = await getLessonsByDate(cursor, 10);
      setDays((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  useEffect(() => {
    if (!cursor) return;
    const sentinel = document.getElementById("lessons-load-more-sentinel");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  const handleAddLesson = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await createLessonBatch();
      await refresh();
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    setDays((prev) =>
      prev
        .map((d) => ({
          ...d,
          entries: d.entries.filter((e) => e.id !== id),
        }))
        .filter((d) => d.entries.length > 0)
    );
    await deleteLessonEntry(id);
  };

  const handleAddPiece = async (pieceId: string, date: string) => {
    await addLessonEntryForPiece(pieceId, date);
    await refresh();
  };

  const activePieceCount = activePieces.length;
  const pieceOrder = new Map<string, number>();
  activePieces.forEach((p, i) => pieceOrder.set(p.id, i));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Lessons</h1>
        <button
          type="button"
          onClick={handleAddLesson}
          disabled={creating}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <PlusIcon className="size-4" />
          {creating ? "Adding..." : "Add new lesson"}
        </button>
      </div>

      {days.map((day) => (
        <LessonDayCard
          key={day.date}
          day={day}
          pieceOrder={pieceOrder}
          activePieces={activePieces}
          onDelete={handleDeleteEntry}
          onAddPiece={handleAddPiece}
        />
      ))}

      {cursor && (
        <div
          id="lessons-load-more-sentinel"
          className="py-4 text-center"
        >
          {loading && (
            <span className="text-sm text-muted-foreground">Loading...</span>
          )}
        </div>
      )}

      {days.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p className="mb-2">No lessons yet.</p>
          <p className="text-sm">
            Click &ldquo;Add new lesson&rdquo; to create one entry per active
            piece{activePieceCount > 0 && ` (${activePieceCount})`} plus a
            general notes row.
          </p>
        </div>
      )}
    </div>
  );
}
