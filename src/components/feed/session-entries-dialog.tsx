"use client";

import { useEffect, useRef, useState } from "react";
import { PlusIcon, SquareIcon, Trash2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getTimerEntriesForSection,
  updateTimerEntryDuration,
  addManualTimerEntry,
  deleteTimerEntry,
} from "@/app/(app)/feed/actions";
import type { TimerCategory } from "@/lib/types";

type TimerEntryRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
};

type SessionEntriesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  category: TimerCategory;
  pieceId: string | null;
  label: string;
};

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function DurationInput({
  value,
  onCommit,
  autoFocus,
}: {
  value: number;
  onCommit: (seconds: number) => void;
  autoFocus?: boolean;
}) {
  const minutes = Math.round(value / 60);
  const [text, setText] = useState(String(minutes));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(String(Math.round(value / 60)));
  }, [value]);

  useEffect(() => {
    if (autoFocus) {
      // Delay to allow dialog animation to complete
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [autoFocus]);

  const commit = () => {
    const parsed = parseInt(text, 10);
    const newSeconds = (isNaN(parsed) || parsed < 0 ? 0 : parsed) * 60;
    if (newSeconds !== value) {
      onCommit(newSeconds);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="h-7 w-14 rounded border border-input bg-transparent px-1.5 text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      <span className="text-xs text-muted-foreground">min</span>
    </div>
  );
}

export function SessionEntriesDialog({
  open,
  onOpenChange,
  date,
  category,
  pieceId,
  label,
}: SessionEntriesDialogProps) {
  const [entries, setEntries] = useState<TimerEntryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusNewId, setFocusNewId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getTimerEntriesForSection(date, category, pieceId).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [open, date, category, pieceId]);

  const handleDurationChange = (entryId: string, newSeconds: number) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, duration_seconds: newSeconds } : e
      )
    );
    updateTimerEntryDuration(entryId, newSeconds);
  };

  const handleStop = (entry: TimerEntryRow) => {
    const elapsed = Math.max(
      0,
      Math.round(
        (Date.now() - new Date(entry.started_at).getTime()) / 1000
      )
    );
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id
          ? { ...e, ended_at: new Date().toISOString(), duration_seconds: elapsed }
          : e
      )
    );
    updateTimerEntryDuration(entry.id, elapsed);
  };

  const handleDelete = (entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    deleteTimerEntry(entryId);
  };

  const handleAdd = () => {
    const optimisticId = `optimistic-${Date.now()}`;
    const now = new Date().toISOString();
    const newEntry: TimerEntryRow = {
      id: optimisticId,
      started_at: now,
      ended_at: now,
      duration_seconds: 0,
    };
    setEntries((prev) => [...prev, newEntry]);
    setFocusNewId(optimisticId);

    // Replace optimistic ID with real server ID once created
    addManualTimerEntry(date, category, pieceId, 0).then((result) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === optimisticId ? { ...e, id: result.id } : e))
      );
      if (focusNewId === optimisticId) setFocusNewId(result.id);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading...
            </p>
          ) : entries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No sessions recorded
            </p>
          ) : (
            entries.map((entry) => {
              const isActive = entry.ended_at === null;
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                >
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatTime(entry.started_at)}
                  </span>
                  {isActive ? (
                    <button
                      type="button"
                      onClick={() => handleStop(entry)}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                    >
                      <SquareIcon className="size-3 fill-current" />
                      Stop
                    </button>
                  ) : (
                    <DurationInput
                      value={entry.duration_seconds}
                      onCommit={(s) => handleDurationChange(entry.id, s)}
                      autoFocus={entry.id === focusNewId}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="ml-auto shrink-0 rounded p-1 text-muted-foreground/50 hover:text-destructive"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center gap-1.5 text-muted-foreground"
          onClick={handleAdd}
        >
          <PlusIcon className="size-4" />
          Add session
        </Button>
      </DialogContent>
    </Dialog>
  );
}
