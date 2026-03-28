"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  MoreHorizontalIcon,
  PencilIcon,
  ArchiveIcon,
  Trash2Icon,
  ArrowUpIcon,
  RotateCcwIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { StatusSelector } from "./status-selector";
import { PieceFormDialog } from "./piece-form-dialog";
import { ArchiveDialog } from "./archive-dialog";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  updatePieceField,
  updatePieceStatus,
  deletePiece,
} from "@/app/(app)/repertoire/actions";
import type { Piece, Collection, PieceStatus } from "@/lib/types";

type EditingColumn = "name" | "composer" | "collection" | "status" | null;

type RowProps = {
  piece: Piece;
  collections: Collection[];
  composerOptions: ComboboxOption[];
  collectionOptions: ComboboxOption[];
  editingColumn: EditingColumn;
  onStartEdit: (column: EditingColumn) => void;
  onStopEdit: () => void;
  onOptimisticUpdate: (piece: Piece) => void;
  onNavigate: (direction: "next" | "prev" | "new-row") => void;
  showStatus?: boolean;
  nameIndent?: number;
};

/**
 * Full table row with its own grid wrapper.
 * Used for non-sortable rows (upcoming, archived tabs).
 */
export function RepertoireTableRow(props: RowProps & { gridClass: string }) {
  return (
    <div className={`group ${props.gridClass}`}>
      <RepertoireTableRowCells {...props} />
    </div>
  );
}

/**
 * Just the cells (Name, Composer, Collection, Actions).
 * Used inside SortableTableRow which provides its own grid wrapper.
 */
export function RepertoireTableRowCells({
  piece,
  collections,
  composerOptions,
  collectionOptions,
  editingColumn,
  onStartEdit,
  onStopEdit,
  onOptimisticUpdate,
  onNavigate,
  showStatus = false,
  nameIndent = 0,
}: RowProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  // Sync status popover with external editing state (e.g. Tab navigation)
  const prevEditingColumn = useRef(editingColumn);
  if (editingColumn === "status" && prevEditingColumn.current !== "status" && !statusOpen) {
    setStatusOpen(true);
  }
  prevEditingColumn.current = editingColumn;

  const collectionName = piece.collection_id
    ? collections.find((c) => c.id === piece.collection_id)?.name ?? null
    : null;

  function saveField(
    field: "name" | "composer" | "collection_id",
    value: string | null,
    optimisticPatch: Partial<Piece>
  ) {
    onOptimisticUpdate({ ...piece, ...optimisticPatch });
    onStopEdit();
    updatePieceField(piece.id, field, value);
  }

  function saveStatus(status: PieceStatus) {
    onOptimisticUpdate({ ...piece, status });
    setStatusOpen(false);
    onStopEdit();
    updatePieceStatus(piece.id, status);
  }

  return (
    <>
      {/* Name */}
      <div
        className={`flex items-center min-w-0 px-3 py-2 border-b border-border/50${
          nameIndent === 1 ? " pl-7" : nameIndent === 2 ? " pl-11" : ""
        }`}
        onClick={() => {
          if (!editingColumn) onStartEdit("name");
        }}
      >
        {editingColumn === "name" ? (
          <NameEditor
            value={piece.name}
            onSave={(v) => saveField("name", v, { name: v })}
            onCancel={onStopEdit}
            onNavigate={onNavigate}
          />
        ) : (
          <Link
            href={`/repertoire/${piece.id}`}
            className="truncate text-sm font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {piece.name}
            {piece.composer && (
              <span className="block truncate text-xs text-muted-foreground font-normal md:hidden">
                {piece.composer}
              </span>
            )}
          </Link>
        )}
      </div>

      {/* Composer */}
      <div
        className="hidden md:flex items-center min-w-0 px-3 py-2 border-b border-border/50 cursor-pointer"
        onClick={() => {
          if (!editingColumn) onStartEdit("composer");
        }}
      >
        {editingColumn === "composer" ? (
          <Combobox
            value={piece.composer ?? ""}
            options={composerOptions}
            onChange={(v) =>
              saveField("composer", v || null, { composer: v || null })
            }
            onClose={onStopEdit}
            onNavigate={onNavigate}
            placeholder="Composer..."
            allowCustom
            className="w-full"
          />
        ) : (
          <span className="truncate text-sm text-muted-foreground">
            {piece.composer || "—"}
          </span>
        )}
      </div>

      {/* Collection */}
      <div
        className="hidden md:flex items-center min-w-0 px-3 py-2 border-b border-border/50 cursor-pointer"
        onClick={() => {
          if (!editingColumn) onStartEdit("collection");
        }}
      >
        {editingColumn === "collection" ? (
          <Combobox
            value={piece.collection_id ?? ""}
            options={collectionOptions}
            onChange={(v) => {
              saveField("collection_id", v || null, {
                collection_id: v || null,
              });
            }}
            onClose={onStopEdit}
            onNavigate={onNavigate}
            placeholder="Collection..."
            className="w-full"
          />
        ) : (
          <span className="truncate text-sm text-muted-foreground">
            {collectionName || "—"}
          </span>
        )}
      </div>

      {/* Status (All tab only) */}
      {showStatus && (
        <div className="flex items-center px-3 py-2 border-b border-border/50">
          <Popover open={statusOpen} onOpenChange={setStatusOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  onClick={() => {
                    setStatusOpen(true);
                    onStartEdit("status");
                  }}
                />
              }
            >
              <StatusBadge status={piece.status} />
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              className="w-auto p-2"
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  setStatusOpen(false);
                  onStopEdit();
                  onNavigate(e.shiftKey ? "prev" : "next");
                } else if (e.key === "Escape") {
                  setStatusOpen(false);
                  onStopEdit();
                }
              }}
            >
              <StatusSelector
                value={piece.status}
                onChange={saveStatus}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center px-1 py-2 border-b border-border/50">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <PieceFormDialog
              piece={piece}
              collections={collections}
              trigger={
                <DropdownMenuItem onClick={(e) => e.preventDefault()}>
                  <PencilIcon />
                  Edit
                </DropdownMenuItem>
              }
            />
            {piece.status !== "archived" && (
              <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
                <ArchiveIcon />
                Archive
              </DropdownMenuItem>
            )}
            {piece.status === "archived" && (
              <DropdownMenuItem
                onClick={() => updatePieceStatus(piece.id, "active")}
              >
                <RotateCcwIcon />
                Reactivate
              </DropdownMenuItem>
            )}
            {piece.status === "upcoming" && (
              <DropdownMenuItem
                onClick={() => updatePieceStatus(piece.id, "active")}
              >
                <ArrowUpIcon />
                Make Active
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => deletePiece(piece.id)}
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ArchiveDialog
        piece={piece}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
      />
    </>
  );
}

function NameEditor({
  value,
  onSave,
  onCancel,
  onNavigate,
}: {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  onNavigate?: (direction: "next" | "prev" | "new-row") => void;
}) {
  const [text, setText] = useState(value);
  const savingRef = useRef(false);

  function save() {
    if (savingRef.current) return;
    if (text.trim() && text.trim() !== value) {
      savingRef.current = true;
      onSave(text.trim());
    } else {
      onCancel();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (text.trim()) {
        savingRef.current = true;
        onSave(text.trim());
      }
      onNavigate?.("new-row");
    } else if (e.key === "Tab") {
      e.preventDefault();
      save();
      onNavigate?.(e.shiftKey ? "prev" : "next");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  function handleBlur() {
    if (!savingRef.current) {
      save();
    }
  }

  return (
    <input
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="h-7 w-full rounded border border-ring bg-background px-2 text-sm font-medium outline-none ring-2 ring-ring/30"
    />
  );
}
