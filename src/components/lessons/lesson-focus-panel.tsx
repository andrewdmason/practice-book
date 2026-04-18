"use client";

import { useLessonView } from "./lesson-view-context";
import { LessonOverviewCard } from "./lesson-overview-card";
import { LessonPieceCard } from "./lesson-piece-card";

export function LessonFocusPanel() {
  const { lesson, activeSectionId } = useLessonView();

  const activeEntry = activeSectionId
    ? lesson.entries.find((e) => e.id === activeSectionId) ?? null
    : null;

  const showPieceCard =
    activeEntry !== null && activeEntry.piece_id !== null;

  return (
    <div className="flex flex-col gap-4">
      {showPieceCard && activeEntry ? (
        <LessonPieceCard
          pieceId={activeEntry.piece_id!}
          pieceName={activeEntry.piece_name ?? "Piece"}
          pieceComposer={activeEntry.piece_composer}
        />
      ) : (
        <LessonOverviewCard />
      )}
    </div>
  );
}
