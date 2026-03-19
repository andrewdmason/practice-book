"use client";

import Link from "next/link";
import { StatusBadge } from "./status-badge";
import { MasteryBadge } from "./mastery-badge";
import type { Piece, Collection } from "@/lib/types";

export function PieceDetailHeader({
  piece,
  collection,
}: {
  piece: Piece;
  collection: Collection | null;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <StatusBadge status={piece.status} />
        <MasteryBadge level={piece.mastery_level} />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight mt-2">
        {piece.name}
      </h2>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
        {piece.composer && <span>{piece.composer}</span>}
        {collection && (
          <>
            <span>&middot;</span>
            <Link
              href={`/repertoire/collections/${collection.id}`}
              className="hover:text-foreground transition-colors"
            >
              {collection.name}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
