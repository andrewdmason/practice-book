"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Ctx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  unread: boolean;
  bumpLatest: (iso?: string) => void;
  currentEntryId: string | null;
  setCurrentEntryId: (id: string | null) => void;
};

const AgentChatContext = createContext<Ctx | null>(null);

const LS_LAST_SEEN = "journal.agentChat.lastSeenAt";
const LS_OPEN = "journal.agentChat.open";

export function AgentChatProvider({
  children,
  initialLatestAt,
}: {
  children: React.ReactNode;
  initialLatestAt: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [latestAt, setLatestAt] = useState<string | null>(initialLatestAt);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  // Hydrate from localStorage after mount. setState-in-effect is correct
  // here because this state lives only in the browser and isn't available
  // during SSR.
  useEffect(() => {
    if (typeof window === "undefined") return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLastSeenAt(window.localStorage.getItem(LS_LAST_SEEN));
    setIsOpen(window.localStorage.getItem(LS_OPEN) === "1");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_OPEN, "1");
    }
    const now = new Date().toISOString();
    setLastSeenAt(now);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_LAST_SEEN, now);
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_OPEN, "0");
    }
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) close();
    else open();
  }, [isOpen, open, close]);

  // Cmd/Ctrl+K toggles the agent sidebar from anywhere in the journal.
  // Esc dismisses it when open.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle, isOpen, close]);

  const bumpLatest = useCallback(
    (iso?: string) => {
      const t = iso ?? new Date().toISOString();
      setLatestAt(t);
      if (isOpen) {
        // If the sidebar is open, the user is presumed to be reading — mark seen.
        setLastSeenAt(t);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LS_LAST_SEEN, t);
        }
      }
    },
    [isOpen]
  );

  const unread = !!latestAt && (!lastSeenAt || latestAt > lastSeenAt);

  return (
    <AgentChatContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        unread,
        bumpLatest,
        currentEntryId,
        setCurrentEntryId,
      }}
    >
      {children}
    </AgentChatContext.Provider>
  );
}

export function useAgentChat(): Ctx {
  const ctx = useContext(AgentChatContext);
  if (!ctx) throw new Error("useAgentChat must be used inside AgentChatProvider");
  return ctx;
}
