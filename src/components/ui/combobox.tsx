"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
};

export function Combobox({
  value,
  options,
  onChange,
  onClose,
  onNavigate,
  placeholder,
  allowCustom = false,
  className,
}: {
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  onClose: () => void;
  onNavigate?: (direction: "next" | "prev" | "new-row") => void;
  placeholder?: string;
  allowCustom?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState(value);
  const [showAll, setShowAll] = useState(true);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = !showAll && query
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-combobox-item]");
      items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const commit = useCallback(
    (val: string) => {
      onChange(val);
      onClose();
    },
    [onChange, onClose]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
          commit(filtered[highlightedIndex].value);
        } else if (allowCustom && query.trim()) {
          commit(query.trim());
        } else if (!allowCustom && filtered.length === 1) {
          commit(filtered[0].value);
        }
        onNavigate?.("new-row");
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "Tab": {
        e.preventDefault();
        // Commit on tab like Enter
        if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
          commit(filtered[highlightedIndex].value);
        } else if (allowCustom && query.trim()) {
          commit(query.trim());
        } else {
          onClose();
        }
        onNavigate?.(e.shiftKey ? "prev" : "next");
        break;
      }
    }
  }

  function handleBlur(e: React.FocusEvent) {
    // If focus moves to the dropdown list, don't close
    if (listRef.current?.contains(e.relatedTarget as Node)) return;
    if (allowCustom) {
      commit(query.trim());
    } else {
      onClose();
    }
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowAll(false);
          setHighlightedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="h-7 w-full rounded border border-ring bg-background px-2 text-sm outline-none ring-2 ring-ring/30"
      />
      {filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md"
        >
          {filtered.map((option, i) => (
            <button
              key={option.value}
              data-combobox-item
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(option.value);
              }}
              onMouseEnter={() => setHighlightedIndex(i)}
              className={cn(
                "flex w-full items-center rounded-md px-2 py-1.5 text-sm",
                i === highlightedIndex
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-accent/50"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
