"use client";

import * as React from "react";
import { SearchDialog } from "./search-dialog";

type SearchContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const SearchContext = React.createContext<SearchContextValue | null>(null);

export function useSearch() {
  const ctx = React.useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within SearchProvider");
  return ctx;
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);

  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);

  // Global Cmd+K / Ctrl+K shortcut
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value = React.useMemo(
    () => ({ isOpen, open, close }),
    [isOpen, open, close]
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
      <SearchDialog open={isOpen} onOpenChange={setIsOpen} />
    </SearchContext.Provider>
  );
}
