"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontalIcon, PencilIcon, ArchiveIcon, Trash2Icon, ArrowUpIcon, RotateCcwIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { PieceFormDialog } from "./piece-form-dialog";
import { ArchiveDialog } from "./archive-dialog";
import { deletePiece, updatePieceStatus } from "@/app/(app)/repertoire/actions";
import type { Piece, Collection } from "@/lib/types";

export function PieceRow({
  piece,
  collections,
  indented = false,
}: {
  piece: Piece;
  collections: Collection[];
  indented?: boolean;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <>
      <div
        className={`group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors ${indented ? "pl-8" : ""}`}
      >
        <Link
          href={`/repertoire/${piece.id}`}
          className="flex flex-1 items-center gap-3 min-w-0"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{piece.name}</p>
            {piece.composer && (
              <p className="truncate text-xs text-muted-foreground">
                {piece.composer}
              </p>
            )}
          </div>
        </Link>

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
