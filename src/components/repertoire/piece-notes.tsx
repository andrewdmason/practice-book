"use client";

import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { updatePieceNotes } from "@/app/(app)/repertoire/actions";

export function PieceNotes({
  pieceId,
  initialNotes,
}: {
  pieceId: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef(initialNotes ?? "");

  async function handleBlur() {
    if (notes === lastSavedRef.current) return;
    setSaving(true);
    await updatePieceNotes(pieceId, notes);
    lastSavedRef.current = notes;
    setSaving(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Notes</h3>
        {saving && (
          <span className="text-xs text-muted-foreground">Saving...</span>
        )}
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add notes about this piece..."
        className="min-h-24"
      />
    </div>
  );
}
