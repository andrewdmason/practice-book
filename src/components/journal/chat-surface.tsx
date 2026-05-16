"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TypingIndicator } from "@/components/journal/typing-indicator";
import {
  appendUserMessage,
  deleteLatestQuestion,
  reopenEntry,
  startNewThread,
} from "@/app/(journal)/journal/actions";
import { useAgentChat } from "@/components/journal/agent-chat-context";
import {
  TIMER_DONE_COLOR,
  useJournalTimer,
} from "@/components/journal/timer-context";
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
  timerStartedAt = null,
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
  /**
   * ISO timestamp the zen timer is anchored to (the opening question's
   * created_at). Wall-clock based, so the timer's progress and completion
   * survive refreshes and reopens.
   */
  timerStartedAt?: string | null;
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [closing, setClosing] = useState(false);
  const [status, setStatus] = useState<"open" | "closed">(initialStatus);
  const [summary, setSummary] = useState<string | null>(initialSummary);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { bumpLatest } = useAgentChat();
  const { begin: beginTimer, stop: stopTimer, done: timerDone } = useJournalTimer();
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom on new content
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Anchor the zen timer to the opening question's timestamp. beginTimer is
  // idempotent for the same anchor, so it's safe to call on every render.
  useEffect(() => {
    if (viewMode !== "today" || status !== "open") return;
    if (!timerStartedAt) return;
    beginTimer(Date.parse(timerStartedAt));
  }, [viewMode, status, timerStartedAt, beginTimer]);

  // The timer belongs to an in-progress today entry only. Clear it when the
  // entry closes or this surface unmounts (e.g. navigating to history).
  useEffect(() => {
    if (status === "closed") stopTimer();
    return () => stopTimer();
  }, [status, stopTimer]);

  // Read a streamed text response, appending each chunk to the trailing
  // (empty) assistant slot reserved by the caller.
  async function pumpStream(res: Response) {
    const reader = res.body!.getReader();
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
  }

  async function streamReply(userMessage: string) {
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
      await pumpStream(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
      setThinking(false);
    }
  }

  // Swap the latest question for a fresh one. Clears the question text in
  // place, streams a replacement, and restores the original if it fails.
  async function handleRegenerate() {
    if (streaming || thinking || closing) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const rejected = last.content;

    setError(null);
    setThinking(true);
    setStreaming(true);
    setMessages((m) => {
      const next = [...m];
      next[next.length - 1] = { role: "assistant", content: "" };
      return next;
    });
    try {
      const res = await fetch("/journal/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "request failed");
        setError(txt);
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: "assistant", content: rejected };
          return next;
        });
        return;
      }
      await pumpStream(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessages((m) => {
        const next = [...m];
        const lastM = next[next.length - 1];
        if (lastM && lastM.role === "assistant" && lastM.content === "") {
          next[next.length - 1] = { role: "assistant", content: rejected };
        }
        return next;
      });
    } finally {
      setStreaming(false);
      setThinking(false);
    }
  }

  // Remove the trailing question entirely — for questions left unanswered
  // (e.g. the timer ran out before the user replied).
  async function handleDeleteQuestion() {
    if (streaming || thinking || closing) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const previous = messages;

    setError(null);
    setMessages((m) => m.slice(0, -1));
    try {
      await deleteLatestQuestion(entryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessages(previous);
    }
  }

  // Once the timer is done the conversation is over: the user's words are
  // still saved, but the interviewer is no longer asked to respond.
  async function appendReply(text: string) {
    try {
      await appendUserMessage(entryId, text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleSubmit(text: string) {
    if (!text || streaming || closing) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    if (timerDone) {
      void appendReply(text);
    } else {
      void streamReply(text);
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
      <div className="flex-1 space-y-6 font-serif text-lg leading-relaxed">
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          // The regenerate icon swaps the current question for a different
          // one. It's offered only on a live follow-up question — the last
          // assistant turn, before it's answered. The opening question (i=0)
          // is excluded since it was already chosen from the picker, and it's
          // hidden once the timer elapses and the agent stops asking.
          // Delete removes the trailing question — useful when the timer ran
          // out before the user answered. Available whenever regenerate is,
          // plus after the timer (when the agent has stopped asking).
          const isLiveQuestion =
            isLast &&
            i > 0 &&
            m.role === "assistant" &&
            status === "open" &&
            !streaming &&
            !thinking &&
            !closing &&
            m.content.trim().length > 0;
          const canRegenerate = isLiveQuestion && !timerDone;
          const canDelete = isLiveQuestion;
          return (
            <div
              key={i}
              className={
                m.role === "assistant"
                  ? "group italic text-muted-foreground pl-6 border-l-2 border-muted"
                  : "text-foreground"
              }
            >
              <p className="whitespace-pre-wrap">
                {m.content}
                {(canRegenerate || canDelete) && (
                  <span className="ml-1.5 inline-flex translate-y-[0.15em] gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    {canRegenerate && (
                      <button
                        type="button"
                        onClick={handleRegenerate}
                        aria-label="Ask a different question"
                        title="Ask a different question"
                        className="inline-flex text-muted-foreground/40 transition-colors hover:text-foreground"
                      >
                        <RegenerateIcon />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={handleDeleteQuestion}
                        aria-label="Delete this question"
                        title="Delete this question"
                        className="inline-flex text-muted-foreground/40 transition-colors hover:text-destructive"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </span>
                )}
              </p>
            </div>
          );
        })}
        {thinking && messages.length > 0 && messages[messages.length - 1].content === "" && (
          <TypingIndicator />
        )}
        {timerDone && !isHistoryClosed && (
          <div className="flex justify-center pt-2">
            <ConversationEndGlyph />
          </div>
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
        <ReplyBox
          active={status === "open" && !streaming && !closing}
          disabled={streaming || closing}
          streaming={streaming}
          placeholder={
            messages.length === 0
              ? ""
              : timerDone
                ? "keep writing if you like…"
                : "type a reply…"
          }
          onSubmit={handleSubmit}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={closing || streaming || messages.length === 0}
            className="font-serif text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40 disabled:hover:no-underline"
          >
            {closing ? "wrapping…" : "done for today"}
          </button>
        </ReplyBox>
      )}
    </div>
  );
}

/**
 * Isolated reply input. Keeps `draft` state local so keystrokes only
 * re-render this small subtree, not the message transcript above it —
 * which otherwise blocks the main thread and tanks INP.
 */
function ReplyBox({
  active,
  disabled,
  streaming,
  placeholder,
  onSubmit,
  children,
}: {
  active: boolean;
  disabled: boolean;
  streaming: boolean;
  placeholder: string;
  onSubmit: (text: string) => void;
  children: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // Keep the reply box focused on mount, after streaming ends, and when
  // status flips back to open (e.g. after reopening a closed entry).
  useEffect(() => {
    if (active) textareaRef.current?.focus();
  }, [active]);

  function submit() {
    const text = draft.trim();
    if (!text || disabled) return;
    setDraft("");
    onSubmit(text);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="mt-12 flex flex-col gap-3">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        rows={1}
        placeholder={placeholder}
        className="w-full resize-none overflow-hidden border-0 bg-transparent font-serif text-lg leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{streaming ? "" : draft.trim() ? "⌘+enter to send · enter for newline" : ""}</span>
        {children}
      </div>
    </div>
  );
}

// A small filled mark that echoes the completed zen timer — it stands at the
// end of the transcript once the five minutes are up to show the
// conversation is over and the interviewer has signed off.
function ConversationEndGlyph() {
  return (
    <div
      aria-hidden
      title="Five minutes done — the conversation is complete."
      className="h-[10px] w-[10px] rounded-full"
      style={{ background: TIMER_DONE_COLOR }}
    />
  );
}

function RegenerateIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
