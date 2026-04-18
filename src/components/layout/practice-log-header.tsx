"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { cn } from "@/lib/utils";

const NEXT_SESSION_VIEW = "next-session";

export function PracticeLogHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusParam = searchParams.get("focus");
  const viewParam = searchParams.get("view");
  const isNextSession = viewParam === NEXT_SESSION_VIEW;

  const {
    activePieces,
    focusedPieceId,
    setFocusedPieceId,
    activePieceInstance,
    setActivePieceInstance,
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

  const buildUrl = useCallback(
    (focusKey: string | null, view: string | null) => {
      const params = new URLSearchParams();
      if (focusKey) params.set("focus", focusKey);
      if (view) params.set("view", view);
      const qs = params.toString();
      return qs ? `/?${qs}` : "/";
    },
    []
  );

  const setUrlState = useCallback(
    (pieceId: string | null, view: string | null) => {
      const url = buildUrl(pieceId, view);
      if (pathname !== "/") {
        router.push(url);
        return;
      }
      window.history.replaceState(null, "", url);
    },
    [pathname, router, buildUrl]
  );

  const currentView = isNextSession ? NEXT_SESSION_VIEW : null;

  const handleAllClick = () => {
    setActivePieceInstance(null);
    setFocusedPieceId(null);
    setUrlState(null, null);
  };

  const handleNextSessionClick = () => {
    setActivePieceInstance(null);
    setUrlState(focusedPieceId, isNextSession ? null : NEXT_SESSION_VIEW);
  };

  const handlePieceClick = (pieceId: string) => {
    setActivePieceInstance(null);
    if (focusedPieceId === pieceId) {
      setFocusedPieceId(null);
      setUrlState(null, currentView);
      return;
    }
    setFocusedPieceId(pieceId);
    setUrlState(pieceId, currentView);
  };

  const clearFocus = useCallback(() => {
    setFocusedPieceId(null);
    setActivePieceInstance(null);
    setUrlState(null, currentView);
  }, [setFocusedPieceId, setActivePieceInstance, setUrlState, currentView]);

  const handleHeaderClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;
      // Header chrome clicks only deactivate the specific piece instance;
      // they leave the filter intact.
      if (activePieceInstance) setActivePieceInstance(null);
    },
    [activePieceInstance, setActivePieceInstance]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Escape clears whichever is most "active" — the specific instance first,
      // then piece focus, then the view filter.
      if (activePieceInstance) {
        setActivePieceInstance(null);
        return;
      }
      if (focusedPieceId) {
        clearFocus();
        return;
      }
      if (isNextSession) {
        setUrlState(null, null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activePieceInstance,
    focusedPieceId,
    isNextSession,
    clearFocus,
    setActivePieceInstance,
    setUrlState,
  ]);

  const stickyRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    function checkStuck() {
      if (!el) return;
      setIsStuck(el.getBoundingClientRect().top <= 56);
    }
    checkStuck();
    window.addEventListener("scroll", checkStuck, { passive: true });
    window.addEventListener("resize", checkStuck);
    return () => {
      window.removeEventListener("scroll", checkStuck);
      window.removeEventListener("resize", checkStuck);
    };
  }, []);

  const focusedPiece = focusedPieceId
    ? activePieces.find((p) => p.id === focusedPieceId)
    : null;

  const title = focusedPiece
    ? `Practice Log: ${focusedPiece.name}`
    : "Practice Log";

  return (
    <div onClick={handleHeaderClick}>
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
        <div className="pl-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
      </div>
      <div
        ref={stickyRef}
        className={cn(
          "sticky top-14 z-40 mt-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          !isStuck && "border-transparent"
        )}
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5 py-2 pl-8">
            <button
              onClick={handleAllClick}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                focusedPieceId === null && !isNextSession
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              All
            </button>
            <button
              onClick={handleNextSessionClick}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                isNextSession
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              Next Session
            </button>
            {activePieces.map((piece) => {
              const isActive = focusedPieceId === piece.id;
              return (
                <button
                  key={piece.id}
                  onClick={() => handlePieceClick(piece.id)}
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
    </div>
  );
}
