"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchTypeahead, searchAll } from "@/app/(app)/search/actions";
import { TypeaheadItem, SearchResultItem } from "./search-result-item";
import type { SearchResult, TypeaheadResult, SearchResultType } from "@/lib/types";

const RESULT_TYPE_ORDER: SearchResultType[] = [
  "piece",
  "work",
  "lesson",
  "practice_entry",
];

const RESULT_TYPE_LABELS: Record<SearchResultType, string> = {
  piece: "Pieces",
  work: "Works",
  practice_entry: "Practice Notes",
  lesson: "Lessons",
};

function groupResults(results: SearchResult[]) {
  const groups: { type: SearchResultType; label: string; items: SearchResult[] }[] = [];
  for (const type of RESULT_TYPE_ORDER) {
    const items = results.filter((r) => r.result_type === type);
    if (items.length > 0) {
      groups.push({ type, label: RESULT_TYPE_LABELS[type], items });
    }
  }
  return groups;
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [typeaheadResults, setTypeaheadResults] = React.useState<TypeaheadResult[]>([]);
  const [fullResults, setFullResults] = React.useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [mode, setMode] = React.useState<"typeahead" | "full">("typeahead");
  const [isSearching, setIsSearching] = React.useState(false);

  // Debounce ref for typeahead
  const typeaheadTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setTypeaheadResults([]);
      setFullResults([]);
      setSelectedIndex(0);
      setMode("typeahead");
      setIsSearching(false);
    }
  }, [open]);

  // All navigable items in current view
  const allItems = React.useMemo(() => {
    if (mode === "typeahead") {
      return typeaheadResults.map((r) => ({ url: r.url, key: `ta-${r.id}` }));
    }
    return fullResults.map((r) => ({ url: r.url, key: `fr-${r.id}` }));
  }, [mode, typeaheadResults, fullResults]);

  function navigateTo(url: string) {
    onOpenChange(false);
    router.push(url);
  }

  async function runFullSearch(q: string) {
    if (q.length < 2) return;
    setIsSearching(true);
    try {
      const results = await searchAll(q);
      setFullResults(results);
      setMode("full");
      setSelectedIndex(0);
    } finally {
      setIsSearching(false);
    }
  }

  function handleInputChange(value: string) {
    setQuery(value);
    setMode("typeahead");
    setSelectedIndex(0);

    // Clear pending timers
    if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
    if (fullSearchTimer.current) clearTimeout(fullSearchTimer.current);

    if (value.length < 2) {
      setTypeaheadResults([]);
      setFullResults([]);
      return;
    }

    // Fast typeahead (150ms debounce)
    typeaheadTimer.current = setTimeout(async () => {
      const results = await searchTypeahead(value);
      setTypeaheadResults(results);
    }, 150);

    // Full search after longer pause (500ms)
    fullSearchTimer.current = setTimeout(() => {
      runFullSearch(value);
    }, 500);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < allItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : allItems.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allItems.length > 0 && selectedIndex < allItems.length) {
        navigateTo(allItems[selectedIndex].url);
      } else if (query.length >= 2) {
        // Trigger full search
        if (fullSearchTimer.current) clearTimeout(fullSearchTimer.current);
        runFullSearch(query);
      }
    }
  }

  const groups = mode === "full" ? groupResults(fullResults) : [];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-[20%] left-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl bg-background text-sm ring-1 ring-foreground/10 shadow-lg outline-none sm:max-w-lg",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          )}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            {isSearching ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pieces, lessons, practice notes..."
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="hidden h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              ESC
            </kbd>
          </div>

          {/* Results area */}
          <div className="max-h-[min(60vh,400px)] overflow-y-auto p-2">
            {query.length < 2 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Type to search...
              </p>
            )}

            {/* Typeahead mode */}
            {mode === "typeahead" && typeaheadResults.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Repertoire
                </div>
                {typeaheadResults.map((result, i) => (
                  <TypeaheadItem
                    key={result.id}
                    result={result}
                    isSelected={i === selectedIndex}
                    onClick={() => navigateTo(result.url)}
                  />
                ))}
              </div>
            )}

            {/* Full search mode */}
            {mode === "full" && groups.length > 0 && (
              <div className="space-y-2">
                {groups.map((group) => {
                  // Calculate the start index for this group
                  let groupStartIndex = 0;
                  for (const g of groups) {
                    if (g.type === group.type) break;
                    groupStartIndex += g.items.length;
                  }

                  return (
                    <div key={group.type}>
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </div>
                      {group.items.map((result, i) => (
                        <SearchResultItem
                          key={result.id}
                          result={result}
                          isSelected={groupStartIndex + i === selectedIndex}
                          onClick={() => navigateTo(result.url)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* No results */}
            {mode === "full" && fullResults.length === 0 && query.length >= 2 && !isSearching && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No results found for &ldquo;{query}&rdquo;
              </p>
            )}

            {/* Typeahead empty + still searching */}
            {mode === "typeahead" && typeaheadResults.length === 0 && query.length >= 2 && !isSearching && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Press Enter to search all content
              </p>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
