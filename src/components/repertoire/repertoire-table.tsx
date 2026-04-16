"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
import { RepertoireTableRow } from "./repertoire-table-row";
import { SortableTableRow } from "./sortable-table-row";
import { NewPieceRow } from "./new-piece-row";
import { reorderPieces } from "@/app/(app)/repertoire/actions";
import type { Piece, Collection, PieceStatus } from "@/lib/types";
import type { ComboboxOption } from "@/components/ui/combobox";

type EditingCell = {
  pieceId: string;
  column: "name" | "composer" | "collection" | "status";
} | null;

type Column = "name" | "composer" | "collection" | "status";
const COLUMNS: Column[] = ["name", "composer", "collection"];
const MOBILE_COLUMNS: Column[] = ["name"];
const ALL_TAB_COLUMNS: Column[] = ["name", "composer", "collection", "status"];
const ALL_TAB_MOBILE_COLUMNS: Column[] = ["name", "status"];

export type TabValue = PieceStatus | "all";

// Shared grid class so all rows align
export const ROW_GRID = "grid grid-cols-[1fr_180px_160px_36px] max-md:grid-cols-[1fr_36px]";
export const ROW_GRID_DRAG = "grid grid-cols-[28px_1fr_180px_160px_36px] max-md:grid-cols-[28px_1fr_36px]";
export const ROW_GRID_ALL = "grid grid-cols-[1fr_180px_160px_100px_36px] max-md:grid-cols-[1fr_auto_36px]";

type ComposerGroup = {
  composer: string;
  subgroups: {
    collectionName: string | null;
    collectionId: string | null;
    pieces: Piece[];
  }[];
};

function groupByComposerThenCollection(
  pieces: Piece[],
  collections: Collection[]
): ComposerGroup[] {
  const collectionMap = new Map(collections.map((c) => [c.id, c]));

  // Group by composer
  const composerMap = new Map<string, Piece[]>();
  for (const piece of pieces) {
    const key = piece.composer || "";
    const arr = composerMap.get(key) ?? [];
    arr.push(piece);
    composerMap.set(key, arr);
  }

  // Sort composers alphabetically, empty string last
  const sortedComposers = [...composerMap.keys()].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });

  return sortedComposers.map((composer) => {
    const piecesForComposer = composerMap.get(composer)!;

    // Group by collection within composer
    const collMap = new Map<string | null, Piece[]>();
    for (const piece of piecesForComposer) {
      const key = piece.collection_id;
      const arr = collMap.get(key) ?? [];
      arr.push(piece);
      collMap.set(key, arr);
    }

    // Sort: collections first (alphabetically), then uncollected
    const sortedKeys = [...collMap.keys()].sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      const nameA = collectionMap.get(a)?.name ?? "";
      const nameB = collectionMap.get(b)?.name ?? "";
      return nameA.localeCompare(nameB);
    });

    const subgroups = sortedKeys.map((collId) => ({
      collectionName: collId ? collectionMap.get(collId)?.name ?? null : null,
      collectionId: collId,
      pieces: collMap.get(collId)!.sort((a, b) => a.name.localeCompare(b.name)),
    }));

    return { composer: composer || "No Composer", subgroups };
  });
}

export function RepertoireTable({
  pieces,
  allPieces,
  collections,
  isActiveTab,
  activeTab,
}: {
  pieces: Piece[];
  allPieces: Piece[];
  collections: Collection[];
  isActiveTab: boolean;
  activeTab: TabValue;
}) {
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [optimisticPieces, setOptimisticPieces] = useState<Map<string, Piece>>(
    new Map()
  );
  const [optimisticNewPieces, setOptimisticNewPieces] = useState<Piece[]>([]);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const prevPiecesRef = useRef(pieces);

  // Clear optimistic new pieces when server data changes (revalidation arrived)
  useEffect(() => {
    if (pieces !== prevPiecesRef.current) {
      prevPiecesRef.current = pieces;
      if (optimisticNewPieces.length > 0) {
        setOptimisticNewPieces([]);
      }
    }
  }, [pieces, optimisticNewPieces.length]);

  // Merge optimistic updates into pieces
  const displayPieces = useMemo(() => {
    const merged = pieces.map((p) => optimisticPieces.get(p.id) ?? p);
    return [...merged, ...optimisticNewPieces];
  }, [pieces, optimisticPieces, optimisticNewPieces]);

  // Apply local drag order for active tab
  const orderedPieces = useMemo(() => {
    if (!isActiveTab || !localOrder) return displayPieces;
    return localOrder
      .map((id) => displayPieces.find((p) => p.id === id))
      .filter(Boolean) as Piece[];
  }, [displayPieces, localOrder, isActiveTab]);

  const composerOptions: ComboboxOption[] = useMemo(() => {
    const unique = [
      ...new Set(allPieces.map((p) => p.composer).filter(Boolean)),
    ] as string[];
    return unique.sort().map((c) => ({ value: c, label: c }));
  }, [allPieces]);

  const collectionOptions: ComboboxOption[] = useMemo(
    () => collections.map((c) => ({ value: c.id, label: c.name })),
    [collections]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const currentOrder = localOrder ?? orderedPieces.map((p) => p.id);
      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      setLocalOrder(newOrder);
      reorderPieces(newOrder);
    },
    [localOrder, orderedPieces]
  );

  function handleOptimisticUpdate(piece: Piece) {
    setOptimisticPieces((prev) => new Map(prev).set(piece.id, piece));
  }

  const [newRowTrigger, setNewRowTrigger] = useState(0);

  const isAllTab = activeTab === "all";

  const groupedData = useMemo(() => {
    if (!isAllTab) return null;
    return groupByComposerThenCollection(displayPieces, collections);
  }, [isAllTab, displayPieces, collections]);

  // Flat list of all pieces in grouped order (for Tab navigation)
  const allTabFlatPieces = useMemo(() => {
    if (!groupedData) return [];
    return groupedData.flatMap((g) =>
      g.subgroups.flatMap((sg) => sg.pieces)
    );
  }, [groupedData]);

  const getVisibleColumns = useCallback(() => {
    if (isAllTab) {
      if (typeof window === "undefined") return ALL_TAB_COLUMNS;
      return window.matchMedia("(min-width: 768px)").matches
        ? ALL_TAB_COLUMNS
        : ALL_TAB_MOBILE_COLUMNS;
    }
    if (typeof window === "undefined") return COLUMNS;
    return window.matchMedia("(min-width: 768px)").matches
      ? COLUMNS
      : MOBILE_COLUMNS;
  }, [isAllTab]);

  const handleNavigate = useCallback(
    (pieceId: string, direction: "next" | "prev" | "new-row") => {
      if (direction === "new-row") {
        setEditingCell(null);
        if (!isAllTab) {
          setNewRowTrigger((t) => t + 1);
        }
        return;
      }

      const cols = getVisibleColumns();
      const currentCol = editingCell?.column ?? "name";
      const colIndex = cols.indexOf(currentCol);
      const pieceList = isAllTab ? allTabFlatPieces : orderedPieces;

      if (direction === "next") {
        if (colIndex < cols.length - 1) {
          setEditingCell({ pieceId, column: cols[colIndex + 1] });
        } else {
          const rowIndex = pieceList.findIndex((p) => p.id === pieceId);
          if (rowIndex < pieceList.length - 1) {
            setEditingCell({
              pieceId: pieceList[rowIndex + 1].id,
              column: cols[0],
            });
          } else if (!isAllTab) {
            setEditingCell(null);
            setNewRowTrigger((t) => t + 1);
          }
        }
      } else {
        if (colIndex > 0) {
          setEditingCell({ pieceId, column: cols[colIndex - 1] });
        } else {
          const rowIndex = pieceList.findIndex((p) => p.id === pieceId);
          if (rowIndex > 0) {
            setEditingCell({
              pieceId: pieceList[rowIndex - 1].id,
              column: cols[cols.length - 1],
            });
          }
        }
      }
    },
    [editingCell, orderedPieces, allTabFlatPieces, isAllTab, getVisibleColumns]
  );

  function handleOptimisticAdd(temp: {
    id: string;
    name: string;
    status: PieceStatus;
  }) {
    const newPiece: Piece = {
      id: temp.id,
      name: temp.name,
      composer: null,
      collection_id: null,
      status: temp.status,
      kind: "piece",
      sort_order: 9999,
      notes: null,
      target_tempo: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setOptimisticNewPieces((prev) => [...prev, newPiece]);
  }

  function handleNavigateToNewPiece(pieceId: string) {
    const cols = getVisibleColumns();
    // Navigate to the second column (first after "name")
    if (cols.length > 1) {
      setEditingCell({ pieceId, column: cols[1] });
    }
  }

  const gridClass = isAllTab ? ROW_GRID_ALL : isActiveTab ? ROW_GRID_DRAG : ROW_GRID;

  const rows = orderedPieces;

  function renderRow(piece: Piece, sortable: boolean, nameIndent?: number) {
    const cellEditing =
      editingCell?.pieceId === piece.id ? editingCell.column : null;

    const sharedProps = {
      piece,
      collections,
      composerOptions,
      collectionOptions,
      editingColumn: cellEditing,
      onStartEdit: (col: Column | null) =>
        col && setEditingCell({ pieceId: piece.id, column: col }),
      onStopEdit: () => setEditingCell(null),
      onOptimisticUpdate: handleOptimisticUpdate,
      onNavigate: (dir: "next" | "prev" | "new-row") =>
        handleNavigate(piece.id, dir),
      gridClass,
      showStatus: isAllTab,
      nameIndent,
    };

    if (sortable) {
      return <SortableTableRow key={piece.id} {...sharedProps} />;
    }
    return <RepertoireTableRow key={piece.id} {...sharedProps} />;
  }

  // --- All tab: grouped rendering ---
  if (isAllTab && groupedData) {
    const allHeader = (
      <div
        className={`${gridClass} text-xs font-medium text-muted-foreground uppercase tracking-wider`}
      >
        <div className="px-3 py-2 border-b">Name</div>
        <div className="hidden md:block px-3 py-2 border-b">Composer</div>
        <div className="hidden md:block px-3 py-2 border-b">Collection</div>
        <div className="px-3 py-2 border-b">Status</div>
        <div className="border-b" />
      </div>
    );

    return (
      <div>
        {allHeader}
        {groupedData.map((group) => (
          <div key={group.composer}>
            {/* Composer header */}
            <div className="px-3 py-2 text-sm font-semibold bg-muted/50 border-b border-border/50">
              {group.composer}
            </div>
            {group.subgroups.map((sg) => (
              <div key={sg.collectionId ?? "__none"}>
                {/* Collection sub-header (only if there's a collection) */}
                {sg.collectionName && (
                  <div className="px-3 py-1.5 pl-7 text-xs font-medium text-muted-foreground bg-muted/25 border-b border-border/50">
                    {sg.collectionName}
                  </div>
                )}
                {sg.pieces.map((piece) =>
                  renderRow(piece, false, sg.collectionName ? 2 : 1)
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // --- Status-filtered tabs ---
  const header = (
    <div
      className={`${gridClass} text-xs font-medium text-muted-foreground uppercase tracking-wider`}
    >
      {isActiveTab && <div className="px-1 py-2 border-b" />}
      <div className="px-3 py-2 border-b">Name</div>
      <div className="hidden md:block px-3 py-2 border-b">Composer</div>
      <div className="hidden md:block px-3 py-2 border-b">Collection</div>
      <div className="border-b" />
    </div>
  );

  const rowElements = rows.map((piece) => renderRow(piece, isActiveTab));

  const newRow = (
    <NewPieceRow
      status={activeTab as PieceStatus}
      showDragColumn={isActiveTab}
      onOptimisticAdd={handleOptimisticAdd}
      onNavigateToNewPiece={handleNavigateToNewPiece}
      gridClass={gridClass}
      activateTrigger={newRowTrigger}
    />
  );

  if (isActiveTab) {
    return (
      <div>
        {header}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rows.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {rowElements}
          </SortableContext>
        </DndContext>
        {newRow}
      </div>
    );
  }

  return (
    <div>
      {header}
      {rowElements}
      {newRow}
    </div>
  );
}
