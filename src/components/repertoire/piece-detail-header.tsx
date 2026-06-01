"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./status-badge";
import { ArchiveDialog } from "./archive-dialog";
import { PerformanceFormDialog } from "./performance-form-dialog";
import { WorkPicker } from "./work-picker";
import { updatePieceDetails, updatePieceStatus } from "@/app/practice/repertoire/actions";
import type { Piece, Work } from "@/lib/types";

export function PieceDetailHeader({
  piece,
  work,
  works,
}: {
  piece: Piece;
  work: Work | null;
  works: Work[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(piece.name);
  const [composer, setComposer] = useState(piece.composer ?? "");
  const [notes, setNotes] = useState(piece.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [addPerformanceOpen, setAddPerformanceOpen] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updatePieceDetails(piece.id, {
      name,
      composer: composer || null,
      notes: notes || null,
    });
    setSaving(false);
    if (!("error" in result)) {
      setEditing(false);
    }
  }

  function handleCancel() {
    setName(piece.name);
    setComposer(piece.composer ?? "");
    setNotes(piece.notes ?? "");
    setEditing(false);
  }

  async function handleReactivate() {
    setReactivating(true);
    await updatePieceStatus(piece.id, "active");
    setReactivating(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <StatusBadge status={piece.status} />
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Piece name"
          className="text-lg font-semibold"
          autoFocus
        />
        <Input
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          placeholder="Composer (optional)"
        />
        <div>
          <label className="text-sm font-medium mb-1.5 block">Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this piece..."
            className="min-h-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <StatusBadge status={piece.status} />
      </div>
      <div className="flex items-start gap-2 mt-2">
        <h2 className="text-2xl font-semibold tracking-tight">{name}</h2>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="mt-1.5 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Piece actions"
          >
            <MoreVerticalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="w-48">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddPerformanceOpen(true)}>
              <PlusIcon />
              Add performance
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {piece.status === "archived" ? (
              <DropdownMenuItem
                onClick={handleReactivate}
                disabled={reactivating}
              >
                <RotateCcwIcon />
                {reactivating ? "Reactivating..." : "Reactivate"}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
                <ArchiveIcon />
                Archive
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
        {composer && <span>{composer}</span>}
        {composer && <span>&middot;</span>}
        <WorkPicker
          piece={piece}
          work={work}
          works={works}
          composer={composer}
        />
      </div>
      {notes && (
        <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
          {notes}
        </p>
      )}

      <ArchiveDialog
        piece={piece}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
      />

      <PerformanceFormDialog
        owner={{ pieceId: piece.id }}
        open={addPerformanceOpen}
        onOpenChange={setAddPerformanceOpen}
      />
    </div>
  );
}
