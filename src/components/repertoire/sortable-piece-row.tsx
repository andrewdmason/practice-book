"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { PieceRow } from "./piece-row";
import type { Piece, Collection } from "@/lib/types";

export function SortablePieceRow({
  piece,
  collections,
}: {
  piece: Piece;
  collections: Collection[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: piece.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 p-1 ml-1 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none"
        aria-label="Drag to reorder"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <div className="flex-1 min-w-0">
        <PieceRow piece={piece} collections={collections} />
      </div>
    </div>
  );
}
