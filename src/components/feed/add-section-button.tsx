"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, PencilIcon, EyeIcon, FileTextIcon, PlusCircleIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSection } from "@/app/(app)/feed/actions";
import { createPiece } from "@/app/(app)/repertoire/actions";
import type { PracticeEntrySection, PieceSuggestion } from "@/lib/types";

type AddSectionButtonProps = {
  entryId: string;
  existingSections: PracticeEntrySection[];
  pieces: PieceSuggestion[];
};

export function AddSectionButton({
  entryId,
  existingSections,
  pieces,
}: AddSectionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showNewPieceDialog, setShowNewPieceDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const hasTechnique = existingSections.some((s) => s.category === "technique");
  const hasSightReading = existingSections.some((s) => s.category === "sight_reading");
  const hasGeneral = existingSections.some((s) => s.category === "general");

  const existingPieceIds = new Set(
    existingSections.filter((s) => s.category === "piece").map((s) => s.piece_id)
  );

  const availablePieces = pieces.filter((p) => !existingPieceIds.has(p.id));

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  const handleAdd = useCallback(
    (category: "technique" | "sight_reading" | "general" | "piece", pieceId?: string) => {
      setOpen(false);
      startTransition(async () => {
        await addSection(entryId, category, pieceId);
        router.refresh();
      });
    },
    [entryId, router]
  );

  async function handleCreatePiece(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("status", "active");
    formData.set("mastery_level", "learning");

    const result = await createPiece(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    if ("pieceId" in result && result.pieceId) {
      await addSection(entryId, "piece", result.pieceId as string);
    }

    setPending(false);
    setShowNewPieceDialog(false);
    router.refresh();
  }

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover/header:opacity-100 transition-all"
          style={open ? { opacity: 1 } : undefined}
        >
          <PlusIcon className="size-4" />
        </button>
        {open && (
          <div
            ref={menuRef}
            className="absolute left-0 top-full z-50 mt-1 w-auto min-w-[180px] rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            {availablePieces.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Pieces</div>
                {availablePieces.map((piece) => (
                  <button
                    key={piece.id}
                    type="button"
                    onClick={() => handleAdd("piece", piece.id)}
                    className="flex w-full flex-col rounded-md px-2 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground outline-none"
                  >
                    <span>{piece.name}</span>
                    {piece.composer && (
                      <span className="text-xs text-muted-foreground">
                        {piece.composer}
                      </span>
                    )}
                  </button>
                ))}
                <div className="-mx-1 my-1 h-px bg-border" />
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowNewPieceDialog(true);
              }}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground outline-none"
            >
              <PlusCircleIcon className="size-4" />
              New piece...
            </button>

            {(!hasTechnique || !hasSightReading || !hasGeneral) && (
              <div className="-mx-1 my-1 h-px bg-border" />
            )}
            {!hasTechnique && (
              <button
                type="button"
                onClick={() => handleAdd("technique")}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground outline-none"
              >
                <PencilIcon className="size-4" />
                Technique
              </button>
            )}
            {!hasSightReading && (
              <button
                type="button"
                onClick={() => handleAdd("sight_reading")}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground outline-none"
              >
                <EyeIcon className="size-4" />
                Sight Reading
              </button>
            )}
            {!hasGeneral && (
              <button
                type="button"
                onClick={() => handleAdd("general")}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground outline-none"
              >
                <FileTextIcon className="size-4" />
                General Notes
              </button>
            )}
          </div>
        )}
      </div>

      {/* New piece dialog */}
      <Dialog open={showNewPieceDialog} onOpenChange={setShowNewPieceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Piece</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePiece} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-piece-name">Name</Label>
              <Input
                id="new-piece-name"
                name="name"
                required
                placeholder="e.g. Scherzo No. 2 in B-flat minor"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-piece-composer">Composer</Label>
              <Input
                id="new-piece-composer"
                name="composer"
                placeholder="e.g. Chopin"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Adding..." : "Add Piece"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
