"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MusicIcon, BookOpenIcon, XIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { useZenMode } from "@/components/layout/zen-mode-context";
import type { PieceKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PracticeBar() {
  const isZenMode = useZenMode();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusParam = searchParams.get("focus");

  const {
    activePieces,
    focusedPieceId,
    setFocusedPieceId,
  } = useTaskTimer();

  // Sync URL focus param → focusedPieceId on mount and param changes
  useEffect(() => {
    if (pathname !== "/") return;
    if (!focusParam) {
      if (focusedPieceId) setFocusedPieceId(null);
      return;
    }
    if (focusedPieceId === focusParam) return;

    const piece = activePieces.find((p) => p.id === focusParam);
    if (piece) {
      setFocusedPieceId(piece.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam, pathname]);

  const setFocusUrl = useCallback(
    (pieceId: string | null) => {
      const typeParam = searchParams.get("type");
      const buildUrl = (focusKey: string | null) => {
        const params = new URLSearchParams();
        if (focusKey) params.set("focus", focusKey);
        if (typeParam) params.set("type", typeParam);
        const qs = params.toString();
        return qs ? `/?${qs}` : "/";
      };

      if (pathname !== "/") {
        router.push(buildUrl(pieceId));
        return;
      }
      window.history.replaceState(null, "", buildUrl(pieceId));
    },
    [pathname, router, searchParams]
  );

  const handlePillClick = (pieceId: string) => {
    if (focusedPieceId === pieceId) {
      setFocusedPieceId(null);
      setFocusUrl(null);
      return;
    }
    setFocusedPieceId(pieceId);
    setFocusUrl(pieceId);
  };

  const clearFocus = useCallback(() => {
    setFocusedPieceId(null);
    setFocusUrl(null);
  }, [setFocusedPieceId, setFocusUrl]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && focusedPieceId) {
        clearFocus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedPieceId, clearFocus]);

  const handleSelectChange = (value: string | null) => {
    if (!value) return;
    handlePillClick(value);
  };

  const showClear = focusedPieceId !== null;

  if (isZenMode) return null;

  return (
    <div className="sticky top-14 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-1.5 px-4 sm:px-6">
        {/* Desktop: piece pill tabs */}
        <div className="hidden md:flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {activePieces.map((piece) => {
            const isActive = focusedPieceId === piece.id;
            const isSystem = (piece.kind as PieceKind) !== "piece";

            return (
              <button
                key={piece.id}
                onClick={() => handlePillClick(piece.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {isSystem ? (
                  <BookOpenIcon className="size-3" />
                ) : (
                  <MusicIcon className="size-3" />
                )}
                {piece.name}
              </button>
            );
          })}

          {showClear && (
            <button
              onClick={clearFocus}
              className="inline-flex items-center justify-center size-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              aria-label="Clear selection"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>

        {/* Mobile: select dropdown */}
        <div className="flex md:hidden flex-1 items-center">
          <Select value={focusedPieceId ?? ""} onValueChange={handleSelectChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All pieces" />
            </SelectTrigger>
            <SelectContent>
              {activePieces.map((piece) => (
                <SelectItem key={piece.id} value={piece.id}>
                  {piece.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
