"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TypingIndicator } from "@/components/journal/typing-indicator";
import {
  pickOpeningQuestion,
  startFreeformEntry,
} from "@/app/(journal)/journal/actions";

const REROLL_LIMIT = 3;

export function OpeningPicker({
  entryId,
  initialCandidates,
  initialRerollCount,
}: {
  entryId: string;
  initialCandidates: string[] | null;
  initialRerollCount: number;
}) {
  const [candidates, setCandidates] = useState<string[]>(
    initialCandidates && initialCandidates.length === 3 ? initialCandidates : []
  );
  const [rerollCount, setRerollCount] = useState(initialRerollCount);
  const [loading, setLoading] = useState(candidates.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const initialLoadRef = useRef(false);

  // On mount, fetch the candidates if the entry doesn't have them yet.
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    if (candidates.length === 3) return;
    void fetchCandidates("/journal/api/opening-candidates");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stagger the cards in whenever a fresh set arrives.
  useEffect(() => {
    if (candidates.length === 0) return;
    setShown(false);
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [candidates]);

  async function fetchCandidates(url: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || "request failed");
        return;
      }
      const data = (await res.json()) as {
        candidates: string[];
        rerollCount: number;
      };
      // Hide before swapping so the new set animates in cleanly.
      setShown(false);
      setCandidates(data.candidates);
      setRerollCount(data.rerollCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleReroll() {
    if (loading || picked || rerollCount >= REROLL_LIMIT) return;
    void fetchCandidates("/journal/api/regenerate-opening");
  }

  function handlePick(question: string) {
    if (loading || picked) return;
    setPicked(question);
    setError(null);
    startTransition(async () => {
      try {
        await pickOpeningQuestion(entryId, question);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPicked(null);
      }
    });
  }

  function handleWriteFreely() {
    if (picked) return;
    setError(null);
    startTransition(async () => {
      try {
        await startFreeformEntry(entryId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  if (picked) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-24 pt-12">
        <p className="font-serif text-lg leading-relaxed text-foreground">
          {picked}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-24 pt-12">
      <p className="font-serif text-sm uppercase tracking-[0.2em] text-muted-foreground">
        pick a question
      </p>

      <div className="mt-8 flex-1">
        {loading && candidates.length === 0 ? (
          <TypingIndicator />
        ) : (
          <ul className="space-y-4">
            {candidates.map((q, i) => (
              <li key={`${rerollCount}-${i}`}>
                <button
                  type="button"
                  onClick={() => handlePick(q)}
                  disabled={loading}
                  style={{ transitionDelay: `${i * 90}ms` }}
                  className={
                    "w-full rounded-lg border border-muted px-5 py-4 text-left font-serif text-lg leading-relaxed text-foreground transition-all duration-500 hover:border-foreground/40 hover:bg-muted/40 disabled:opacity-50 " +
                    (shown
                      ? "translate-y-0 opacity-100"
                      : "translate-y-1 opacity-0")
                  }
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={handleWriteFreely}
          disabled={!!picked}
          className="mt-4 w-full rounded-lg border border-dashed border-muted px-5 py-4 text-left font-serif text-lg leading-relaxed text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
        >
          I already know what I want to write
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="mt-10">
        {candidates.length === 0 && !loading && error ? (
          <button
            type="button"
            onClick={() => void fetchCandidates("/journal/api/opening-candidates")}
            className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            try again
          </button>
        ) : (
          rerollCount < REROLL_LIMIT && (
            <button
              type="button"
              onClick={handleReroll}
              disabled={loading}
              className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              {loading ? "thinking…" : "show me three different ones"}
            </button>
          )
        )}
      </div>
    </div>
  );
}
