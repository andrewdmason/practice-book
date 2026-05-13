import type { Piece } from "@/lib/types";

export type PieceMenuEntry =
  | { kind: "piece"; piece: Piece }
  | {
      kind: "collection";
      collectionId: string;
      name: string;
      pieces: Piece[];
    };

/** Group pieces by collection, preserving the input order. A collection only
 * becomes a submenu when more than one of its pieces is in the input list and
 * its name is known. Single-piece collections render flat. */
export function groupPiecesForMenu(
  pieces: Piece[],
  collectionsById: Record<string, string>
): PieceMenuEntry[] {
  const piecesByCollection = new Map<string, Piece[]>();
  for (const piece of pieces) {
    if (!piece.collection_id) continue;
    const list = piecesByCollection.get(piece.collection_id) ?? [];
    list.push(piece);
    piecesByCollection.set(piece.collection_id, list);
  }

  const entries: PieceMenuEntry[] = [];
  const seenCollections = new Set<string>();
  for (const piece of pieces) {
    const collectionId = piece.collection_id;
    const collectionName = collectionId
      ? collectionsById[collectionId]
      : undefined;
    const collectionPieces = collectionId
      ? piecesByCollection.get(collectionId)
      : undefined;
    if (
      collectionId &&
      collectionName &&
      collectionPieces &&
      collectionPieces.length > 1
    ) {
      if (seenCollections.has(collectionId)) continue;
      seenCollections.add(collectionId);
      entries.push({
        kind: "collection",
        collectionId,
        name: collectionName,
        pieces: collectionPieces,
      });
    } else {
      entries.push({ kind: "piece", piece });
    }
  }
  return entries;
}
