"use client";

import { useState, useMemo } from "react";
import { PlusIcon, LibraryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieceFormDialog } from "./piece-form-dialog";
import { CollectionFormDialog } from "./collection-form-dialog";
import { RepertoireTable, type TabValue } from "./repertoire-table";
import type {
  Piece,
  Collection,
  CollectionWithPieces,
  PieceStatus,
} from "@/lib/types";
import { PIECE_STATUS_LABELS } from "@/lib/types";

const TABS: TabValue[] = ["active", "upcoming", "archived", "all"];

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
}: {
  pieces: Piece[];
  collections: CollectionWithPieces[];
}) {
  const [activeTab, setActiveTab] = useState<TabValue>("active");
  const allCollections: Collection[] = collections;

  // Flatten all pieces (standalone + from collections) for the current tab
  const allPieces = useMemo(() => {
    const standalone = pieces.filter((p) => p.collection_id === null);
    const fromCollections = collections.flatMap((c) => c.pieces);
    return [...standalone, ...fromCollections];
  }, [pieces, collections]);

  const tabPieces = useMemo(() => {
    if (activeTab === "all") {
      return allPieces.sort((a, b) => a.name.localeCompare(b.name));
    }
    const filtered = allPieces.filter((p) => p.status === activeTab);
    if (activeTab === "active") {
      return filtered.sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
      );
    }
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [allPieces, activeTab]);

  const hasAnyPieces = allPieces.length > 0;
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
          const count =
            tab === "all"
              ? allPieces.length
              : getStatusCount(tab, pieces, collections);
          const label =
            tab === "all" ? "All" : PIECE_STATUS_LABELS[tab];
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
              {label}
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

      {!hasAnyPieces && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No pieces yet. Add your first piece to get started.</p>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-visible">
        <CardContent className="p-0">
          <RepertoireTable
            pieces={tabPieces}
            allPieces={allPieces}
            collections={allCollections}
            isActiveTab={isActiveTab}
            activeTab={activeTab}
          />
        </CardContent>
      </Card>
    </div>
  );
}
