"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { useZenMode } from "@/components/layout/zen-mode-context";
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

  const buildUrl = useCallback((focusKey: string | null) => {
    const params = new URLSearchParams();
    if (focusKey) params.set("focus", focusKey);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }, []);

  const setFocusUrl = useCallback(
    (pieceId: string | null) => {
      const url = buildUrl(pieceId);
      if (pathname !== "/") {
        router.push(url);
        return;
      }
      window.history.replaceState(null, "", url);
    },
    [pathname, router, buildUrl]
  );

  const handlePillClick = (pieceId: string | null) => {
    if (pieceId === null) {
      setFocusedPieceId(null);
      setFocusUrl(null);
      return;
    }
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

  if (isZenMode) return null;

  return (
    <div className="sticky top-14 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-1.5 px-4 sm:px-6">
        {/* Piece pill tabs (with "All") */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
          <button
            onClick={() => handlePillClick(null)}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              focusedPieceId === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            All
          </button>
          {activePieces.map((piece) => {
            const isActive = focusedPieceId === piece.id;
            return (
              <button
                key={piece.id}
                onClick={() => handlePillClick(piece.id)}
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {piece.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
