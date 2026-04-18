"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { addPieceToLesson } from "@/app/(app)/lessons/actions";
import type { LessonEntryWithPiece } from "@/lib/types";

export function AddPieceSection({
  lessonId,
  entries,
}: {
  lessonId: string;
  entries: LessonEntryWithPiece[];
}) {
  const { activePieces } = useTaskTimer();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const existingPieceIds = new Set(
    entries.map((e) => e.piece_id).filter((id): id is string => id !== null)
  );
  const addable = activePieces.filter((p) => !existingPieceIds.has(p.id));

  const handleAdd = (pieceId: string) => {
    startTransition(async () => {
      await addPieceToLesson(lessonId, pieceId);
      router.refresh();
    });
  };

  if (addable.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
        disabled={pending}
      >
        <PlusIcon className="size-4" />
        Add piece
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {addable.map((piece) => (
          <DropdownMenuItem
            key={piece.id}
            onClick={() => handleAdd(piece.id)}
          >
            <div className="flex flex-col">
              <span className="text-sm">{piece.name}</span>
              {piece.composer && (
                <span className="text-xs text-muted-foreground">
                  {piece.composer}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
