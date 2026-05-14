"use client";

import { useState } from "react";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateWork } from "@/app/(app)/repertoire/actions";
import type { Work } from "@/lib/types";

export function WorkDetailHeader({ work }: { work: Work }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(work.name);
  const [composer, setComposer] = useState(work.composer ?? "");
  const [notes, setNotes] = useState(work.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("composer", composer);
    formData.set("notes", notes);
    const result = await updateWork(work.id, formData);
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
  }

  function handleCancel() {
    setName(work.name);
    setComposer(work.composer ?? "");
    setNotes(work.notes ?? "");
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mb-6 space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Work name"
          className="text-lg font-semibold"
          autoFocus
        />
        <Input
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          placeholder="Composer (optional)"
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium">Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this work..."
            className="min-h-24"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-start gap-2">
        <h1 className="font-heading text-2xl font-semibold">{work.name}</h1>
        <button
          onClick={() => setEditing(true)}
          className="mt-1.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Edit work details"
        >
          <PencilIcon className="size-4" />
        </button>
      </div>
      {work.composer && (
        <p className="mt-1 text-muted-foreground">{work.composer}</p>
      )}
      {work.notes && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {work.notes}
        </p>
      )}
    </div>
  );
}
