"use client";

import Link from "next/link";
import type { Piece } from "@/lib/types";

export function PieceRow({ piece }: { piece: Piece }) {
  return (
    <div className="px-3 py-2 text-sm">
      <Link
        href={`/practice/repertoire/${piece.id}`}
        className="hover:underline"
      >
        {piece.name}
      </Link>
    </div>
  );
}
