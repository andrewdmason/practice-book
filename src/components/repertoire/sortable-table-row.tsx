"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { RepertoireTableRowCells } from "./repertoire-table-row";
import type { Piece, Collection } from "@/lib/types";
import type { ComboboxOption } from "@/components/ui/combobox";

type EditingColumn = "name" | "composer" | "collection" | "status" | "mastery" | null;

export function SortableTableRow({
  piece,
  collections,
  composerOptions,
  collectionOptions,
  editingColumn,
  onStartEdit,
  onStopEdit,
  onOptimisticUpdate,
  onNavigate,
  gridClass,
  showStatus,
  nameIndent,
}: {
  piece: Piece;
  collections: Collection[];
  composerOptions: ComboboxOption[];
  collectionOptions: ComboboxOption[];
  editingColumn: EditingColumn;
  onStartEdit: (column: EditingColumn) => void;
  onStopEdit: () => void;
  onOptimisticUpdate: (piece: Piece) => void;
  onNavigate: (direction: "next" | "prev" | "new-row") => void;
  gridClass: string;
  showStatus?: boolean;
  nameIndent?: number;
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
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    backgroundColor: isDragging ? "var(--color-background)" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`group ${gridClass}`}>
      {/* Drag handle */}
      <div className="flex items-center justify-center border-b border-border/50">
        <button
          {...attributes}
          {...listeners}
          className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none"
          aria-label="Drag to reorder"
        >
          <GripVerticalIcon className="size-4" />
        </button>
      </div>
      <RepertoireTableRowCells
        piece={piece}
        collections={collections}
        composerOptions={composerOptions}
        collectionOptions={collectionOptions}
        editingColumn={editingColumn}
        onStartEdit={onStartEdit}
        onStopEdit={onStopEdit}
        onOptimisticUpdate={onOptimisticUpdate}
        onNavigate={onNavigate}
        showStatus={showStatus}
        nameIndent={nameIndent}
      />
    </div>
  );
}
