"use client";

import { useState, useTransition } from "react";
import { applyInterviewerTemplate } from "@/app/(journal)/settings/interviewer/actions";
import {
  INTERVIEWER_TEMPLATES,
  matchTemplateId,
} from "@/lib/journal/seeds/interviewer-templates";

/** Infer the current age from the Interviewer doc; "" if it's been hand-edited
 * (so it no longer matches any preset). */
function matchAge(content: string): string {
  return matchTemplateId(content) ?? "";
}

export function InterviewerAgeSelector({
  interviewerContent,
}: {
  interviewerContent: string;
}) {
  const [selected, setSelected] = useState(() => matchAge(interviewerContent));
  const [justApplied, setJustApplied] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id || id === selected) return;
    const label =
      INTERVIEWER_TEMPLATES.find((t) => t.id === id)?.label ?? id;

    const ok = window.confirm(
      `Switching to ${label} will replace this person's interviewer voice and reset their morning question mix to the ${label} defaults. Continue?`
    );
    // Not confirming leaves `selected` unchanged, so the controlled <select>
    // snaps back to its previous value.
    if (!ok) return;

    setSelected(id);
    setJustApplied(false);
    startTransition(async () => {
      try {
        await applyInterviewerTemplate(id);
        setJustApplied(true);
      } catch (err) {
        setSelected(matchAge(interviewerContent));
        alert(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const edited = selected === "";

  return (
    <div className="mb-8 border-b border-border pb-6">
      <label
        htmlFor="interviewer-age"
        className="font-serif text-xs uppercase tracking-wide text-muted-foreground"
      >
        Interviewer reading level
      </label>
      <p className="mt-1 font-serif text-xs italic text-muted-foreground">
        Tunes how the morning questions sound and which kinds get asked, for an
        age. Changing it resets the Interviewer prompt and question mix to that
        age&apos;s defaults.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <select
          id="interviewer-age"
          value={selected}
          onChange={handleChange}
          disabled={pending}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm disabled:opacity-50 sm:w-64"
        >
          {edited && (
            <option value="" disabled>
              Edited — custom voice
            </option>
          )}
          {INTERVIEWER_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {pending ? "applying…" : justApplied ? "applied" : ""}
        </span>
      </div>
    </div>
  );
}
