"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TypingIndicator } from "@/components/journal/typing-indicator";
import {
  pickOpeningQuestion,
  saveQuoteEntry,
  startFreeformEntry,
} from "@/app/(journal)/journal/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { normalizeCandidates, typeLabel } from "@/lib/journal/candidates";
import type { JournalOpeningCandidate } from "@/lib/types";

export function OpeningPicker({
  entryId,
  initialCandidates,
  initialRerollCount,
  questionTypeNames = [],
}: {
  entryId: string;
  initialCandidates: JournalOpeningCandidate[] | null;
  initialRerollCount: number;
  questionTypeNames?: string[];
}) {
  const [candidates, setCandidates] = useState<JournalOpeningCandidate[]>(() =>
    normalizeCandidates(initialCandidates)
  );
  const [rerollCount, setRerollCount] = useState(initialRerollCount);
  const [loading, setLoading] = useState(candidates.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [mode, setMode] = useState<"pick" | "quote">("pick");
  const [quoteText, setQuoteText] = useState("");
  const [attribution, setAttribution] = useState("");
  const [savingQuote, setSavingQuote] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const initialLoadRef = useRef(false);

  // On mount, fetch the candidates if the entry doesn't have them yet.
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    if (candidates.length > 0) return;
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

  async function fetchCandidates(url: string, extra?: { categoryName?: string }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, ...extra }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || "request failed");
        return;
      }
      const data = (await res.json()) as {
        candidates: JournalOpeningCandidate[];
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
    if (loading || picked) return;
    void fetchCandidates("/journal/api/regenerate-opening");
  }

  function handleAskSpecific(categoryName: string) {
    if (loading || picked) return;
    void fetchCandidates("/journal/api/regenerate-opening", { categoryName });
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

  function handleSaveQuote() {
    const quote = quoteText.trim();
    if (!quote || savingQuote) return;
    setSavingQuote(true);
    setError(null);
    startTransition(async () => {
      try {
        await saveQuoteEntry(entryId, quote, attribution);
        router.push(`/journal/${entryId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setSavingQuote(false);
      }
    });
  }

  // Quote-compose mode: a frictionless capture with no question, no follow-ups.
  if (mode === "quote") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-24 pt-12">
        <p className="font-serif text-sm uppercase tracking-[0.2em] text-muted-foreground">
          save a quote
        </p>

        <div className="mt-8 flex-1">
          <textarea
            autoFocus
            value={quoteText}
            onChange={(e) => setQuoteText(e.target.value)}
            placeholder="the quote…"
            rows={4}
            disabled={savingQuote}
            className="w-full resize-none rounded-lg border border-muted bg-transparent px-5 py-4 font-serif text-lg leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:outline-none disabled:opacity-50"
          />
          <input
            type="text"
            value={attribution}
            onChange={(e) => setAttribution(e.target.value)}
            placeholder="— who / context (optional)"
            disabled={savingQuote}
            className="mt-4 w-full rounded-lg border border-muted bg-transparent px-5 py-3 font-serif text-base leading-relaxed text-muted-foreground placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:outline-none disabled:opacity-50"
          />
        </div>

        {error && (
          <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="mt-10 flex items-center gap-x-5">
          <button
            type="button"
            onClick={handleSaveQuote}
            disabled={!quoteText.trim() || savingQuote}
            className="font-serif text-sm text-foreground underline-offset-4 hover:underline disabled:opacity-40 disabled:hover:no-underline"
          >
            {savingQuote ? "saving…" : "save quote"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (savingQuote) return;
              setMode("pick");
              setError(null);
            }}
            disabled={savingQuote}
            className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40"
          >
            cancel
          </button>
        </div>
      </div>
    );
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
            {candidates.map((c, i) => {
              const label = typeLabel(c.type);
              return (
                <li key={`${rerollCount}-${i}`}>
                  <button
                    type="button"
                    onClick={() => handlePick(c.text)}
                    disabled={loading}
                    style={{ transitionDelay: `${i * 90}ms` }}
                    className={
                      "w-full rounded-lg border border-muted px-5 py-4 text-left transition-all duration-500 hover:border-foreground/40 hover:bg-muted/40 disabled:opacity-50 " +
                      (shown
                        ? "translate-y-0 opacity-100"
                        : "translate-y-1 opacity-0")
                    }
                  >
                    {label && (
                      <span className="mb-1.5 block font-serif text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground">
                        {label}
                      </span>
                    )}
                    <span className="font-serif text-lg leading-relaxed text-foreground">
                      {c.text}
                    </span>
                  </button>
                </li>
              );
            })}
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
        <button
          type="button"
          onClick={() => {
            if (picked) return;
            setError(null);
            setMode("quote");
          }}
          disabled={!!picked}
          className="mt-4 w-full rounded-lg border border-dashed border-muted px-5 py-4 text-left font-serif text-lg leading-relaxed text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
        >
          save a quote
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
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={handleReroll}
              disabled={loading}
              className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              {loading
                ? "thinking…"
                : candidates.length === 1
                  ? "show me a different one"
                  : "show me a different set"}
            </button>
            {questionTypeNames.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      disabled={loading}
                      className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40 disabled:hover:no-underline"
                    />
                  }
                >
                  ask about something specific…
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  className="max-h-72 w-56 overflow-y-auto"
                >
                  {questionTypeNames.map((name) => (
                    <DropdownMenuItem
                      key={name}
                      onClick={() => handleAskSpecific(name)}
                      className="font-serif"
                    >
                      {typeLabel(name)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
