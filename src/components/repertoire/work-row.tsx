"use client";

import Link from "next/link";
import { Fragment } from "react";
import type { Work, Piece } from "@/lib/types";

export function WorkRow({
  work,
  pieces,
}: {
  work: Work;
  pieces: Piece[];
}) {
  return (
    <div className="px-3 py-2 text-sm">
      <Link
        href={`/practice/repertoire/works/${work.id}`}
        className="font-medium hover:underline"
      >
        {work.name}
      </Link>
      {pieces.length > 0 && (
        <>
          {": "}
          {pieces.map((piece, i) => (
            <Fragment key={piece.id}>
              {i > 0 && ", "}
              <Link
                href={`/practice/repertoire/${piece.id}`}
                className="hover:underline"
              >
                {piece.name}
              </Link>
            </Fragment>
          ))}
        </>
      )}
    </div>
  );
}
