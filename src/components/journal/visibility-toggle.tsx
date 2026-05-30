"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Users } from "lucide-react";
import { setEntryVisibility } from "@/app/(journal)/journal/actions";
import type { JournalEntryStatus, JournalVisibility } from "@/lib/types";

/**
 * The author's private ↔ family control for their own entry. Sharing is opt-in:
 * flipping to "family" surfaces a *closed* entry in the family feed. Toggling it
 * on an entry that's still open just records the intent — it won't appear to
 * anyone until the entry is finished, which the hint makes explicit.
 */
export function VisibilityToggle({
  entryId,
  initialVisibility,
  status,
}: {
  entryId: string;
  initialVisibility: JournalVisibility;
  status: JournalEntryStatus;
}) {
  const router = useRouter();
  const [visibility, setVisibility] = useState<JournalVisibility>(initialVisibility);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(next: JournalVisibility) {
    if (next === visibility || isPending) return;
    const previous = visibility;
    setVisibility(next);
    setError(null);
    startTransition(async () => {
      try {
        await setEntryVisibility(entryId, next);
        router.refresh();
      } catch (err) {
        setVisibility(previous);
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const isFamily = visibility === "family";

  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <div className="inline-flex items-center gap-1 self-start rounded-full border border-muted p-0.5">
        <Segment
          active={!isFamily}
          onClick={() => choose("private")}
          icon={<Lock className="size-3.5" />}
          label="Personal"
        />
        <Segment
          active={isFamily}
          onClick={() => choose("family")}
          icon={<Users className="size-3.5" />}
          label="Family"
        />
      </div>
      {isFamily && status === "open" && (
        <p className="font-serif text-xs italic text-muted-foreground">
          Will share with the family once you finish this entry.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Segment({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-serif text-xs transition-colors " +
        (active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {icon}
      {label}
    </button>
  );
}
