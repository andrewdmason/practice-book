"use client";

import { useState, useRef, useEffect } from "react";
import { PlusIcon } from "lucide-react";
import { createPiece } from "@/app/(app)/repertoire/actions";
import type { PieceStatus } from "@/lib/types";

export function NewPieceRow({
  status,
  showDragColumn,
  onOptimisticAdd,
  onNavigateToNewPiece,
  gridClass,
  activateTrigger = 0,
}: {
  status: PieceStatus;
  showDragColumn: boolean;
  onOptimisticAdd: (tempPiece: {
    id: string;
    name: string;
    status: PieceStatus;
  }) => void;
  onNavigateToNewPiece?: (pieceId: string) => void;
  gridClass: string;
  activateTrigger?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const handledByKeyRef = useRef(false);

  // Activate from external trigger (e.g. Enter key in another row)
  useEffect(() => {
    if (activateTrigger > 0) {
      setEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [activateTrigger]);

  function createAndAdd(name: string) {
    const tempId = `temp-${Date.now()}`;
    onOptimisticAdd({ id: tempId, name, status });

    const formData = new FormData();
    formData.set("name", name);
    formData.set("status", status);
    formData.set("mastery_level", "learning");

    return { tempId, promise: createPiece(formData) };
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      const name = value.trim();
      if (!name) return;

      handledByKeyRef.current = true;

      // Create piece and keep input open for rapid-fire
      createAndAdd(name);
      setValue("");
      // Input stays focused — user can immediately type the next name
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const name = value.trim();
      if (!name) return;

      handledByKeyRef.current = true;

      // Create piece, wait for real ID, then navigate to its next column
      const { promise } = createAndAdd(name);
      setValue("");
      setEditing(false);

      promise.then((result) => {
        if (result.success && result.pieceId) {
          onNavigateToNewPiece?.(result.pieceId);
        }
      });
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
      setValue("");
    }
  }

  function handleBlur() {
    // Skip if already handled by Enter/Tab
    if (handledByKeyRef.current) {
      handledByKeyRef.current = false;
      return;
    }
    const name = value.trim();
    if (name) {
      createAndAdd(name);
    }
    setValue("");
    setEditing(false);
  }

  // The new row spans: [drag?] [name+composer+collection+mastery] [actions]
  // We use the same grid but span the middle columns
  return (
    <div className={gridClass}>
      {showDragColumn && <div />}
      <div
        className="flex items-center min-w-0 px-3 py-2 col-span-4 max-md:col-span-2 cursor-pointer"
        onClick={() => {
          if (!editing) {
            setEditing(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="Piece name..."
            className="h-7 w-full rounded border border-ring bg-background px-2 text-sm outline-none ring-2 ring-ring/30"
          />
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground/70 hover:text-muted-foreground transition-colors">
            <PlusIcon className="size-4" />
            New
          </span>
        )}
      </div>
      <div />
    </div>
  );
}
