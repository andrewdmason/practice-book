"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Gauge } from "lucide-react";

export type SuggestionItem = {
  id: string;
  type: "metronome" | "hint";
  title: string;
  subtitle?: string | null;
  data?: Record<string, unknown>;
};

export type SuggestionListRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

type SuggestionListProps = {
  items: SuggestionItem[];
  command: (item: SuggestionItem) => void;
};

export const SuggestionList = forwardRef<SuggestionListRef, SuggestionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const actionableItems = items.filter((i) => i.type !== "hint");

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (actionableItems.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + actionableItems.length - 1) % actionableItems.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % actionableItems.length);
          return true;
        }
        if (event.key === "Enter") {
          const item = actionableItems[selectedIndex];
          if (item) command(item);
          return true;
        }
        if (event.key === "Escape") {
          return true;
        }
        return false;
      },
    }));

    // Hint state (just typed @)
    const hint = items.find((i) => i.type === "hint");
    if (hint) {
      return (
        <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gauge className="size-3.5 shrink-0" />
            {hint.title}
          </div>
        </div>
      );
    }

    if (items.length === 0) return null;

    return (
      <div className="max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
        {actionableItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "text-popover-foreground hover:bg-accent/50"
            }`}
            onClick={() => command(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <Gauge className="size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{item.title}</div>
              {item.subtitle && (
                <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  }
);

SuggestionList.displayName = "SuggestionList";
