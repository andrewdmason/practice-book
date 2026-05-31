"use client";

import { useEffect, useRef, useState, useTransition } from "react";

/**
 * The small inline editor used both to write a new comment and to edit an
 * existing one. ⌘/Ctrl+Enter submits, Esc cancels — matching the reply box in
 * chat-surface.tsx. Keeps its own draft state so typing doesn't re-render the
 * surrounding post.
 */
export function InlineCommentComposer({
  initialValue = "",
  placeholder = "Add a comment…",
  submitLabel = "Comment",
  autoFocus = true,
  onSubmit,
  onCancel,
}: {
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  /** Persist the comment. Throw to surface an error and keep the composer open. */
  onSubmit: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasDraft = draft.trim().length > 0;

  // Auto-grow the textarea to fit its content.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  function submit() {
    const text = draft.trim();
    if (!text || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        await onSubmit(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="rounded-md border border-border bg-background/60 px-3 py-2">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={isPending}
        rows={1}
        placeholder={placeholder}
        className="min-h-6 w-full resize-none overflow-hidden border-0 bg-transparent font-serif text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      <div className="mt-2 flex items-center gap-x-4">
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !hasDraft}
          className="font-serif text-sm text-foreground underline-offset-4 hover:underline disabled:opacity-40 disabled:hover:no-underline"
        >
          {isPending ? "saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
