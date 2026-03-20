"use client";

import { cn } from "@/lib/utils";
import type { PieceStatus } from "@/lib/types";
import { PIECE_STATUSES, PIECE_STATUS_LABELS } from "@/lib/types";

const statusColors: Record<PieceStatus, string> = {
  active:
    "data-[selected=true]:bg-emerald-50 data-[selected=true]:text-emerald-700 data-[selected=true]:border-emerald-300",
  upcoming:
    "data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700 data-[selected=true]:border-blue-300",
  archived:
    "data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-500 data-[selected=true]:border-zinc-300",
};

export function StatusSelector({
  value,
  onChange,
}: {
  value: PieceStatus;
  onChange: (status: PieceStatus) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PIECE_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          data-selected={value === status}
          onClick={() => onChange(status)}
          className={cn(
            "rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted",
            statusColors[status],
            value !== status && "text-muted-foreground"
          )}
        >
          {PIECE_STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  );
}
