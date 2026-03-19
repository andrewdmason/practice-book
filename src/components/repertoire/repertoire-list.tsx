"use client";

import { useState, useCallback } from "react";
import { PlusIcon, LibraryIcon } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieceFormDialog } from "./piece-form-dialog";
import { CollectionFormDialog } from "./collection-form-dialog";
import { PieceRow } from "./piece-row";
import { SortablePieceRow } from "./sortable-piece-row";
import { CollectionRow } from "./collection-row";
import { GettingStaleSection } from "./getting-stale-section";
import { reorderPieces } from "@/app/(app)/repertoire/actions";
import type {
  Piece,
  Collection,
  CollectionWithPieces,
  PieceStatus,
  PieceWithLastPlayed,
} from "@/lib/types";
import { PIECE_STATUS_LABELS } from "@/lib/types";

const TABS: PieceStatus[] = ["active", "upcoming", "archived"];

function getStatusCount(
  status: PieceStatus,
  pieces: Piece[],
  collections: CollectionWithPieces[]
): number {
  const standalone = pieces.filter(
    (p) => p.collection_id === null && p.status === status
  ).length;
  const inCollections = collections.reduce(
    (sum, c) => sum + c.pieces.filter((p) => p.status === status).length,
    0
  );
  return standalone + inCollections;
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
  const [activeTab, setActiveTab] = useState<PieceStatus>("active");
  const allCollections: Collection[] = collections;
  const hasAnyPieces = pieces.length > 0;

  // For active tab, maintain local order for optimistic drag updates
  const allActivePieces = [
    ...pieces.filter((p) => p.collection_id === null && p.status === "active"),
    ...collections.flatMap((c) =>
      c.pieces.filter((p) => p.status === "active")
    ),
  ].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const [localActiveOrder, setLocalActiveOrder] = useState<string[] | null>(null);

  const standalonePieces = pieces.filter(
    (p) => p.collection_id === null && p.status === activeTab
  );
  const filteredCollections = collections
    .map((c) => ({
      collection: c,
      pieces: c.pieces.filter((p) => p.status === activeTab),
    }))
    .filter((c) => c.pieces.length > 0);
  const totalCount = standalonePieces.length +
    filteredCollections.reduce((sum, c) => sum + c.pieces.length, 0);

  // Build the sorted active pieces list (standalone + collection pieces, sorted together)
  const sortedActivePieces = localActiveOrder
    ? localActiveOrder
        .map((id) => allActivePieces.find((p) => p.id === id))
        .filter(Boolean) as Piece[]
    : allActivePieces;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const currentOrder = localActiveOrder ?? allActivePieces.map((p) => p.id);
      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      setLocalActiveOrder(newOrder);
      reorderPieces(newOrder);
    },
    [localActiveOrder, allActivePieces]
  );

  const isActiveTab = activeTab === "active";

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

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const count = getStatusCount(tab, pieces, collections);
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {PIECE_STATUS_LABELS[tab]}
              {count > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 min-w-5 h-5 justify-center"
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "active" && <GettingStaleSection stalePieces={stalePieces} />}

      {!hasAnyPieces && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No pieces yet. Add your first piece to get started.</p>
          </CardContent>
        </Card>
      )}

      {hasAnyPieces && totalCount === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No {PIECE_STATUS_LABELS[activeTab].toLowerCase()} pieces.
        </p>
      )}

      {totalCount > 0 && isActiveTab && (
        <Card>
          <CardContent className="px-1 py-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedActivePieces.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {sortedActivePieces.map((piece) => (
                  <SortablePieceRow
                    key={piece.id}
                    piece={piece}
                    collections={allCollections}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
      )}

      {totalCount > 0 && !isActiveTab && (
        <Card>
          <CardContent className="px-1 py-2">
            {filteredCollections.map(({ collection, pieces: collPieces }) => (
              <CollectionRow
                key={collection.id}
                collection={collection}
                pieces={collPieces}
                allCollections={allCollections}
              />
            ))}
            {standalonePieces.map((piece) => (
              <PieceRow
                key={piece.id}
                piece={piece}
                collections={allCollections}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
