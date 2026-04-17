"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { cn } from "@/lib/utils";

export function PracticeLogHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusParam = searchParams.get("focus");

  const {
    activePieces,
    focusedPieceId,
    setFocusedPieceId,
  } = useTaskTimer();

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

  const focusedPiece = focusedPieceId
    ? activePieces.find((p) => p.id === focusedPieceId)
    : null;

  const title = focusedPiece
    ? `Practice Log: ${focusedPiece.name}`
    : "Practice Log";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
      <div className="pl-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
