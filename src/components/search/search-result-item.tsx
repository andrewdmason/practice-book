"use client";

import {
  Music,
  FolderOpen,
  BookOpen,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchResult, TypeaheadResult, SearchResultType } from "@/lib/types";

const typeConfig: Record<
  SearchResultType | "collection",
  { icon: typeof Music; label: string }
> = {
  piece: { icon: Music, label: "Piece" },
  collection: { icon: FolderOpen, label: "Collection" },
  practice_entry: { icon: PenLine, label: "Practice" },
  lesson: { icon: BookOpen, label: "Lesson" },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TypeaheadItem({
  result,
  isSelected,
  onClick,
}: {
  result: TypeaheadResult;
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = typeConfig[result.type];
  const Icon = config.icon;

  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted"
      )}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <span className="font-medium">{result.name}</span>
        {result.composer && (
          <span className="ml-2 text-muted-foreground">{result.composer}</span>
        )}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {config.label}
      </span>
    </button>
  );
}

export function SearchResultItem({
  result,
  isSelected,
  onClick,
}: {
  result: SearchResult;
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = typeConfig[result.result_type];
  const Icon = config.icon;

  return (
    <button
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted"
      )}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium truncate">{result.title}</span>
          {result.subtitle && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {result.subtitle}
            </span>
          )}
        </div>
        {result.preview && (
          <p
            className="mt-0.5 text-xs text-muted-foreground line-clamp-2 [&_mark]:bg-yellow-200/60 [&_mark]:text-foreground [&_mark]:rounded-sm"
            dangerouslySetInnerHTML={{ __html: result.preview }}
          />
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {config.label}
        </span>
        {result.date && (
          <span className="text-xs text-muted-foreground">
            {formatDate(result.date)}
          </span>
        )}
      </div>
    </button>
  );
}
