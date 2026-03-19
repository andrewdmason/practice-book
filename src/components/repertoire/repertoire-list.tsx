"use client";

import { PlusIcon, LibraryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieceFormDialog } from "./piece-form-dialog";
import { CollectionFormDialog } from "./collection-form-dialog";
import { PieceRow } from "./piece-row";
import { CollectionRow } from "./collection-row";
import { GettingStaleSection } from "./getting-stale-section";
import type {
  Piece,
  Collection,
  CollectionWithPieces,
  PieceStatus,
  PieceWithLastPlayed,
} from "@/lib/types";
import { PIECE_STATUS_LABELS } from "@/lib/types";

type StatusGroup = {
  status: PieceStatus;
  standalonePieces: Piece[];
  collections: { collection: Collection; pieces: Piece[] }[];
};

function groupByStatus(
  pieces: Piece[],
  collectionsWithPieces: CollectionWithPieces[]
): StatusGroup[] {
  const statuses: PieceStatus[] = ["active", "upcoming", "archived"];

  return statuses.map((status) => {
    const standalonePieces = pieces.filter(
      (p) => p.collection_id === null && p.status === status
    );

    const collections = collectionsWithPieces
      .map((c) => ({
        collection: c,
        pieces: c.pieces.filter((p) => p.status === status),
      }))
      .filter((c) => c.pieces.length > 0);

    return { status, standalonePieces, collections };
  });
}

export function RepertoireList({
  pieces,
  collections,
  stalePieces = [],
}: {
  pieces: Piece[];
  collections: CollectionWithPieces[];
  stalePieces?: PieceWithLastPlayed[];
}) {
  const statusGroups = groupByStatus(pieces, collections);
  const allCollections: Collection[] = collections;
  const hasAnyPieces = pieces.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Repertoire</h2>
        <div className="flex gap-2">
          <CollectionFormDialog
            trigger={
              <Button variant="outline" size="sm">
                <LibraryIcon data-icon="inline-start" />
                Collection
              </Button>
            }
          />
          <PieceFormDialog
            collections={allCollections}
            trigger={
              <Button size="sm">
                <PlusIcon data-icon="inline-start" />
                Piece
              </Button>
            }
          />
        </div>
      </div>

      <GettingStaleSection stalePieces={stalePieces} />

      {!hasAnyPieces && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No pieces yet. Add your first piece to get started.</p>
          </CardContent>
        </Card>
      )}

      {statusGroups.map((group) => {
        const totalCount =
          group.standalonePieces.length +
          group.collections.reduce((sum, c) => sum + c.pieces.length, 0);
        if (totalCount === 0) return null;

        return (
          <Card key={group.status}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">
                  {PIECE_STATUS_LABELS[group.status]}
                </CardTitle>
                <Badge variant="secondary">{totalCount}</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-1 pb-2">
              {group.collections.map(({ collection, pieces: collPieces }) => (
                <CollectionRow
                  key={collection.id}
                  collection={collection}
                  pieces={collPieces}
                  allCollections={allCollections}
                />
              ))}
              {group.standalonePieces.map((piece) => (
                <PieceRow
                  key={piece.id}
                  piece={piece}
                  collections={allCollections}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
