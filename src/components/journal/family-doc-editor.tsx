"use client";

import { useState, useTransition } from "react";
import { saveFamilyDoc } from "@/app/(journal)/settings/family/actions";

export function FamilyDocEditor({ initialContent }: { initialContent: string }) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = content !== savedContent;

  function handleSave() {
    startTransition(async () => {
      try {
        await saveFamilyDoc(content);
        setSavedContent(content);
        setJustSaved(true);
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="mt-10 border-t border-border pt-6">
      <h3 className="font-serif text-xs uppercase tracking-wide text-muted-foreground">
        Family context
      </h3>
      <p className="mt-1 font-serif text-xs italic text-muted-foreground">
        Shared notes about your family — who everyone is, ages, anything worth
        knowing. Every member&apos;s interviewer reads this, and it seeds the
        &ldquo;build your profile&rdquo; prompt. Only you can edit it.
      </p>
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          if (justSaved) setJustSaved(false);
        }}
        rows={12}
        spellCheck
        className="mt-3 w-full rounded-md border border-border bg-card p-4 font-serif text-base leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="mt-3 flex items-center justify-end gap-3 text-xs">
        <span className="text-muted-foreground">
          {justSaved ? "saved" : dirty ? "unsaved changes" : ""}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || pending}
          className="font-serif text-sm text-foreground underline-offset-4 hover:underline disabled:opacity-40 disabled:hover:no-underline"
        >
          {pending ? "saving…" : "save"}
        </button>
      </div>
    </div>
  );
}
