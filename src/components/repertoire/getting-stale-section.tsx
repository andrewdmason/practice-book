"use client";

import Link from "next/link";
import { ClockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { daysSince } from "@/lib/timer-utils";
import type { PieceWithLastPlayed } from "@/lib/types";

export function GettingStaleSection({
  stalePieces,
}: {
  stalePieces: PieceWithLastPlayed[];
}) {
  if (stalePieces.length === 0) return null;

  return (
    <div className="rounded-lg border-l-4 border-amber-300 bg-amber-50/50 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-amber-800">
        <ClockIcon className="size-4" />
        <span className="font-medium">Getting Stale</span>
        <Badge variant="secondary" className="text-xs">
          {stalePieces.length}
        </Badge>
      </div>
      <div className="mt-2 space-y-1">
        {stalePieces.map((piece) => {
          const days = daysSince(piece.last_played);
          const label =
            days === null
              ? "Never practiced"
              : `${days} day${days === 1 ? "" : "s"} ago`;

          return (
            <div
              key={piece.id}
              className="flex items-center justify-between text-sm"
            >
              <Link
                href={`/practice/repertoire/${piece.id}`}
                className="text-amber-900 hover:underline truncate"
              >
                {piece.name}
              </Link>
              <span className="text-xs text-amber-700/70 shrink-0 ml-2">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
