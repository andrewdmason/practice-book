"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TypingIndicator } from "@/components/journal/typing-indicator";
import { ZenTimer } from "@/components/journal/zen-timer";
import { reopenEntry, startNewThread } from "@/app/(journal)/journal/actions";
import { useAgentChat } from "@/components/journal/agent-chat-context";
import type { JournalMessageRole } from "@/lib/types";

type Msg = { role: JournalMessageRole; content: string };

async function typeOut(
  text: string,
  msPerChar: number,
  set: (s: string) => void
) {
  for (let i = 1; i <= text.length; i++) {
    set(text.slice(0, i));
    await new Promise((r) => setTimeout(r, msPerChar));
  }
}

export function ChatSurface({
  entryId,
  initialStatus,
  initialMessages,
  initialSummary,
  viewMode = "today",
}: {
  entryId: string;
  initialStatus: "open" | "closed";
  initialMessages: Msg[];
  initialSummary: string | null;
  /**
   * "today" — closed state shows the inbox-zero "done for today" view.
   * "history" — closed state shows the full transcript with the summary
   * surfaced above and a reopen link. Open state behaves the same in both.
   */
  viewMode?: "today" | "history";
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [closing, setClosing] = useState(false);
  const [status, setStatus] = useState<"open" | "closed">(initialStatus);
  const [summary, setSummary] = useState<string | null>(initialSummary);
  const [error, setError] = useState<string | null>(null);
  const [rejectedQuestions, setRejectedQuestions] = useState<string[]>([]);
  const [timerRunning, setTimerRunning] = useState(false);

  const REROLL_LIMIT = 3;
  const router = useRouter();
  const { bumpLatest } = useAgentChat();
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const initialLoadRef = useRef(false);

  // Auto-grow textarea
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // Scroll to bottom on new content
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Start the zen timer once the opening question has finished generating.
  useEffect(() => {
    if (timerRunning) return;
    if (viewMode !== "today" || status !== "open") return;
    if (streaming || thinking) return;
    const first = messages[0];
    if (first?.role === "assistant" && first.content.trim().length > 0) {
      setTimerRunning(true);
    }
  }, [timerRunning, viewMode, status, streaming, thinking, messages]);

  // Keep the reply box focused: on mount, after streaming ends, and when
  // status flips back to open (e.g. after reopening a closed entry).
  useEffect(() => {
    if (status !== "open") return;
    if (streaming || closing) return;
    textareaRef.current?.focus();
  }, [status, streaming, closing]);

  // On mount: if entry is open and has no messages, request the opening question
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    if (status === "open" && messages.length === 0) {
      void streamReply(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function streamReply(userMessage: string | null) {
    setError(null);
    setThinking(true);
    setStreaming(true);
    // Reserve an empty assistant slot we'll fill as the stream arrives
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/journal/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, userMessage }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "request failed");
        setError(txt);
        setStreaming(false);
        setThinking(false);
        // Remove the empty assistant slot we reserved
        setMessages((m) => {
          const next = [...m];
          if (next.length > 0 && next[next.length - 1].role === "assistant" && next[next.length - 1].content === "") {
            next.pop();
          }
          return next;
        });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let firstChunk = true;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (firstChunk) {
          setThinking(false);
          firstChunk = false;
        }
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { role: "assistant", content: last.content + chunk };
          }
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
      setThinking(false);
    }
  }

  async function handleReroll() {
    if (streaming || closing) return;
    if (rejectedQuestions.length >= REROLL_LIMIT) return;
    // Capture current opening question text
    const current = messages[0];
    if (!current || current.role !== "assistant" || !current.content.trim()) return;
    const nextRejected = [...rejectedQuestions, current.content.trim()];
    setRejectedQuestions(nextRejected);
    setError(null);
    setThinking(true);
    setStreaming(true);
    // Reset to single empty assistant slot we'll fill as the new stream arrives
    setMessages([{ role: "assistant", content: "" }]);
    try {
      const res = await fetch("/journal/api/regenerate-opening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, rejected: nextRejected }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "request failed");
        setError(txt);
        setStreaming(false);
        setThinking(false);
        setMessages([]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let firstChunk = true;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (firstChunk) {
          setThinking(false);
          firstChunk = false;
        }
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { role: "assistant", content: last.content + chunk };
          }
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
      setThinking(false);
    }
  }

  async function handleSubmit() {
    const text = draft.trim();
    if (!text || streaming || closing) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    await streamReply(text);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  async function handleClose() {
    if (closing || streaming || messages.length === 0) return;
    // Flip to the "done" view immediately for an inbox-zero feel; the
    // conversation disappears and a thinking indicator stands in for the
    // summary while we wait for the wrap pass.
    setClosing(true);
    setStatus("closed");
    setSummary(null);
    setError(null);
    try {
      const res = await fetch("/journal/api/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      if (!res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        let msg = `close failed (${res.status})`;
        if (ct.includes("application/json")) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          if (body?.error) msg = body.error;
        } else {
          const txt = await res.text().catch(() => "");
          if (txt) msg = txt;
        }
        console.error("[journal] close failed:", msg);
        setError(msg);
        // Roll back so the user can retry.
        setStatus("open");
        setClosing(false);
        return;
      }
      const data = (await res.json()) as {
        summary: string | null;
        surfacedCount?: number;
      };
      if ((data.surfacedCount ?? 0) > 0) bumpLatest();
      // Type the summary in for warmth.
      if (data.summary) {
        await typeOut(data.summary, 18, setSummary);
      } else {
        setSummary(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[journal] close threw:", err);
      setError(msg);
      setStatus("open");
    } finally {
      setClosing(false);
    }
  }

  function handleReopen() {
    startTransition(async () => {
      try {
        await reopenEntry(entryId);
        setStatus("open");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleNewThread() {
    startTransition(async () => {
      try {
        await startNewThread();
        // /journal will pick up the new (latest) entry on refresh.
        router.push("/journal");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  if (status === "closed" && viewMode === "today") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-24 pt-12 text-center">
        <p className="font-serif text-sm uppercase tracking-[0.2em] text-muted-foreground">
          done for today
        </p>
        <div className="mt-6 min-h-[3.5rem] flex items-center justify-center">
          {summary ? (
            <p className="font-serif text-xl italic leading-relaxed text-foreground">
              {summary}
              {closing && <span className="ml-0.5 inline-block w-[2px] h-[1.1em] align-[-0.2em] bg-foreground/60 animate-pulse" />}
            </p>
          ) : (
            <TypingIndicator />
          )}
        </div>
        {!closing && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <button
              type="button"
              onClick={handleNewThread}
              className="font-serif text-sm text-foreground underline-offset-4 hover:underline"
            >
              ask me something else
            </button>
            <button
              type="button"
              onClick={handleReopen}
              className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              reopen this thread
            </button>
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </div>
        )}
      </div>
    );
  }

  const isHistoryClosed = status === "closed" && viewMode === "history";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-24 pt-12">
      {!isHistoryClosed && timerRunning && (
        <div className="mb-8">
          <ZenTimer running={timerRunning} />
        </div>
      )}
      {isHistoryClosed && summary && (
        <p className="mb-10 font-serif text-base italic text-muted-foreground">
          {summary}
        </p>
      )}

      <div className="flex-1 space-y-6 font-serif text-lg leading-relaxed">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "assistant"
                ? "text-foreground"
                : "text-foreground/80 pl-6 border-l-2 border-muted"
            }
          >
            <p className="whitespace-pre-wrap">{m.content || (thinking && i === messages.length - 1 ? "" : "")}</p>
          </div>
        ))}
        {thinking && messages.length > 0 && messages[messages.length - 1].content === "" && (
          <TypingIndicator />
        )}
        {!streaming &&
          !thinking &&
          status === "open" &&
          messages.length === 1 &&
          messages[0].role === "assistant" &&
          messages[0].content.trim().length > 0 &&
          rejectedQuestions.length < REROLL_LIMIT && (
            <button
              type="button"
              onClick={handleReroll}
              className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ask something else
            </button>
          )}
        <div ref={scrollRef} />
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </div>
      )}

      {isHistoryClosed ? (
        <div className="mt-12">
          <button
            type="button"
            onClick={handleReopen}
            className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            reopen this thread
          </button>
        </div>
      ) : (
        <div className="mt-12 flex flex-col gap-3">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={streaming || closing}
            rows={1}
            placeholder={messages.length === 0 ? "" : "type a reply…"}
            className="w-full resize-none overflow-hidden border-0 bg-transparent font-serif text-lg leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{streaming ? "" : draft.trim() ? "enter to send · shift+enter for newline" : ""}</span>
            <button
              type="button"
              onClick={handleClose}
              disabled={closing || streaming || messages.length === 0}
              className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              {closing ? "wrapping…" : "done for today"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
