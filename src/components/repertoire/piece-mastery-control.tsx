"use client";

import { useState } from "react";
import { MasterySelector } from "./mastery-selector";
import { updatePieceMastery } from "@/app/(app)/repertoire/actions";
import type { MasteryLevel } from "@/lib/types";

export function PieceMasteryControl({
  pieceId,
  initialLevel,
}: {
  pieceId: string;
  initialLevel: MasteryLevel;
}) {
  const [level, setLevel] = useState(initialLevel);

  async function handleChange(newLevel: MasteryLevel) {
    setLevel(newLevel);
    await updatePieceMastery(pieceId, newLevel);
  }

  return (
    <div>
      <h3 className="text-sm font-medium mb-2">Mastery Level</h3>
      <MasterySelector value={level} onChange={handleChange} />
    </div>
  );
}
