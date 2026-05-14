import type { Piece } from "@/lib/types";

export type PieceMenuEntry =
  | { kind: "piece"; piece: Piece }
  | {
      kind: "work";
      workId: string;
      name: string;
      pieces: Piece[];
    };

/** Group pieces by work, preserving the input order. A work only becomes a
 * submenu when more than one of its pieces is in the input list and its name
 * is known. Single-piece works render flat. */
export function groupPiecesForMenu(
  pieces: Piece[],
  worksById: Record<string, string>
): PieceMenuEntry[] {
  const piecesByWork = new Map<string, Piece[]>();
  for (const piece of pieces) {
    if (!piece.work_id) continue;
    const list = piecesByWork.get(piece.work_id) ?? [];
    list.push(piece);
    piecesByWork.set(piece.work_id, list);
  }

  const entries: PieceMenuEntry[] = [];
  const seenWorks = new Set<string>();
  for (const piece of pieces) {
    const workId = piece.work_id;
    const workName = workId ? worksById[workId] : undefined;
    const workPieces = workId ? piecesByWork.get(workId) : undefined;
    if (
      workId &&
      workName &&
      workPieces &&
      workPieces.length > 1
    ) {
      if (seenWorks.has(workId)) continue;
      seenWorks.add(workId);
      entries.push({
        kind: "work",
        workId,
        name: workName,
        pieces: workPieces,
      });
    } else {
      entries.push({ kind: "piece", piece });
    }
  }
  return entries;
}
