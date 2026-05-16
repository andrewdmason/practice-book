"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Settings, X } from "lucide-react";
import { useAgentChat } from "@/components/journal/agent-chat-context";
import { loadAgentChatMessages } from "@/app/(journal)/journal/actions";
import { cn } from "@/lib/utils";

type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  source_entry_id: string | null;
  created_at: string;
};

export function AgentChatSidebar() {
  const { isOpen, close, currentEntryId, bumpLatest } = useAgentChat();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load messages once when sidebar first opens (or first mount if open).
  useEffect(() => {
    if (!isOpen || loaded) return;
    let cancel = false;
    (async () => {
      try {
        const rows = await loadAgentChatMessages();
        if (cancel) return;
        setMessages(rows as Msg[]);
        setLoaded(true);
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancel = true;
    };
  }, [isOpen, loaded]);

  // Refetch when sidebar opens *after* loaded (covers wrap-pass surfacing
  // happening while the sidebar was closed).
  useEffect(() => {
    if (!isOpen || !loaded) return;
    let cancel = false;
    (async () => {
      try {
        const rows = await loadAgentChatMessages();
        if (cancel) return;
        setMessages(rows as Msg[]);
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancel = true;
    };
  }, [isOpen, loaded]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // Auto-scroll on new content
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Keep the input focused while the sidebar is open and idle.
  useEffect(() => {
    if (!isOpen || streaming) return;
    // Wait for the slide-in transition to settle before focusing so the
    // page doesn't jump weirdly on the first open.
    const t = setTimeout(() => textareaRef.current?.focus(), 220);
    return () => clearTimeout(t);
  }, [isOpen, streaming, messages.length]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft("");
    setError(null);

    const optimisticUserId = `opt-${Date.now()}`;
    const optimisticAssistantId = `opt-${Date.now()}-a`;
    setMessages((m) => [
      ...m,
      {
        id: optimisticUserId,
        role: "user",
        content: text,
        source_entry_id: null,
        created_at: new Date().toISOString(),
      },
      {
        id: optimisticAssistantId,
        role: "assistant",
        content: "",
        source_entry_id: null,
        created_at: new Date().toISOString(),
      },
    ]);
    setThinking(true);
    setStreaming(true);

    try {
      const res = await fetch("/journal/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: text, currentEntryId }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "request failed");
        setError(txt);
        // Roll back optimistic assistant slot
        setMessages((m) => m.filter((x) => x.id !== optimisticAssistantId));
        setStreaming(false);
        setThinking(false);
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
          if (last && last.id === optimisticAssistantId) {
            next[next.length - 1] = { ...last, content: last.content + chunk };
          }
          return next;
        });
      }
      bumpLatest();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
      setThinking(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <aside
      aria-hidden={!isOpen}
      className={cn(
        "fixed inset-y-0 right-0 z-[60] flex w-full max-w-[420px] flex-col border-l border-border bg-background shadow-lg transition-transform duration-200",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="font-serif text-base text-foreground">agent</span>
        <div className="flex items-center gap-1">
          <Link
            href="/journal/agent"
            onClick={close}
            aria-label="Agent settings"
            title="Agent settings"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={close}
            aria-label="Close agent chat"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && loaded && (
          <p className="font-serif text-sm italic text-muted-foreground">
            No messages yet. Tell the agent how to adjust itself, or ask what it currently knows.
          </p>
        )}
        <div className="space-y-5 font-serif text-[15px] leading-relaxed">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} thinking={thinking && m.content === "" && m.role === "assistant"} />
          ))}
          <div ref={scrollRef} />
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="shrink-0 border-t border-border px-4 py-3">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={streaming}
          placeholder="ask the agent…"
          className="w-full resize-none overflow-hidden border-0 bg-transparent font-serif text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{currentEntryId ? "current entry in context" : ""}</span>
          <span>{draft.trim() ? "enter to send · shift+enter for newline" : ""}</span>
        </div>
      </div>
    </aside>
  );
}

function MessageBubble({ message, thinking }: { message: Msg; thinking: boolean }) {
  if (message.role === "user") {
    return (
      <div className="border-l-2 border-muted pl-3 text-foreground/80">
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    );
  }
  return (
    <div>
      {message.source_entry_id && (
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          from a journal entry
        </p>
      )}
      {thinking ? (
        <div className="flex items-center gap-1.5 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:0ms] [animation-duration:1.4s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:200ms] [animation-duration:1.4s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:400ms] [animation-duration:1.4s]" />
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-foreground">{message.content}</p>
      )}
    </div>
  );
}
