"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPiece,
  updatePiece,
  createWork,
} from "@/app/practice/repertoire/actions";
import type { Piece, Work, PieceStatus } from "@/lib/types";
import { PIECE_STATUSES, PIECE_STATUS_LABELS } from "@/lib/types";

const ADD_NEW = "__add_new__";

export function PieceFormDialog({
  piece,
  works,
  composers,
  trigger,
}: {
  piece?: Piece;
  works: Work[];
  composers: string[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<PieceStatus>(piece?.status ?? "active");

  // Composer: either pick from the dropdown or type a new one
  const initialComposer = piece?.composer ?? "";
  const initialComposerCustom =
    !!initialComposer && !composers.includes(initialComposer);
  const [composer, setComposer] = useState(initialComposer);
  const [composerCustom, setComposerCustom] = useState(initialComposerCustom);

  // Work: pick existing, none, or create a new one. Filtered to the
  // current composer (works are owned by a composer).
  const initialWorkId = piece?.work_id ?? "";
  const [workId, setWorkId] = useState<string>(initialWorkId);
  const [newWorkName, setNewWorkName] = useState("");
  const [workCustom, setWorkCustom] = useState(false);

  const composerKey = composer.trim().toLowerCase();
  const availableWorks = composerKey
    ? works.filter((w) => (w.composer ?? "").trim().toLowerCase() === composerKey)
    : [];

  // If the composer changes and the currently-selected work no longer
  // matches, clear it.
  useEffect(() => {
    if (workId && !availableWorks.some((w) => w.id === workId)) {
      setWorkId("");
    }
  }, [availableWorks, workId]);

  function resetState() {
    setStatus(piece?.status ?? "active");
    setComposer(piece?.composer ?? "");
    setComposerCustom(initialComposerCustom);
    setWorkId(piece?.work_id ?? "");
    setNewWorkName("");
    setWorkCustom(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    // Composer (always controlled)
    formData.set("composer", composer.trim());

    // If user is creating a new work, create it first and use its id
    let resolvedWorkId = workId;
    if (workCustom) {
      const trimmed = newWorkName.trim();
      if (!trimmed) {
        setError("New work name is required");
        setPending(false);
        return;
      }
      const workForm = new FormData();
      workForm.set("name", trimmed);
      workForm.set("composer", composer.trim());
      const workResult = await createWork(workForm);
      if (!workResult.success || !workResult.workId) {
        setError(workResult.error ?? "Failed to create work");
        setPending(false);
        return;
      }
      resolvedWorkId = workResult.workId;
    }

    formData.set("status", status);
    formData.set("work_id", resolvedWorkId);

    const result = piece
      ? await updatePiece(piece.id, formData)
      : await createPiece(formData);

    setPending(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) resetState();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<span />} nativeButton={false}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{piece ? "Edit Piece" : "Add Piece"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="piece-name">Name</Label>
            <Input
              id="piece-name"
              name="name"
              required
              defaultValue={piece?.name ?? ""}
              placeholder="e.g. Scherzo No. 2 in B-flat minor"
            />
          </div>

          {/* Composer */}
          <div className="grid gap-2">
            <Label htmlFor="piece-composer">Composer</Label>
            {composerCustom || composers.length === 0 ? (
              <div className="flex gap-2">
                <Input
                  id="piece-composer"
                  autoFocus={composerCustom}
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  placeholder="e.g. Chopin"
                />
                {composers.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setComposerCustom(false);
                      setComposer("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ) : (
              <Select
                value={composer}
                onValueChange={(v) => {
                  const val = v ?? "";
                  if (val === ADD_NEW) {
                    setComposerCustom(true);
                    setComposer("");
                  } else {
                    setComposer(val);
                  }
                }}
              >
                <SelectTrigger id="piece-composer" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {composers.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value={ADD_NEW}>+ Add new composer</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Work */}
          <div className="grid gap-2">
            <Label>Work</Label>
            {workCustom ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={newWorkName}
                  onChange={(e) => setNewWorkName(e.target.value)}
                  placeholder="e.g. French Suite No. 5 in G"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setWorkCustom(false);
                    setNewWorkName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Select
                value={workId}
                onValueChange={(v) => {
                  const val = v ?? "";
                  if (val === ADD_NEW) {
                    setWorkCustom(true);
                    setWorkId("");
                  } else {
                    setWorkId(val);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None (standalone)">
                    {workId
                      ? works.find((w) => w.id === workId)?.name ??
                        "None (standalone)"
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (standalone)</SelectItem>
                  {availableWorks.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={ADD_NEW}>+ Add new work</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PieceStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIECE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PIECE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="piece-notes">Notes</Label>
            <Textarea
              id="piece-notes"
              name="notes"
              defaultValue={piece?.notes ?? ""}
              placeholder="Optional notes..."
              className="min-h-20"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : piece ? "Save Changes" : "Add Piece"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
