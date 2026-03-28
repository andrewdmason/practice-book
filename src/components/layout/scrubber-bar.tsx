"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTimer } from "@/components/timer/timer-context";
import { useZenMode } from "@/components/layout/zen-mode-context";
import { useVideo } from "@/components/video/video-context";
import { SectionScrubber } from "@/components/layout/section-scrubber";
import { getSections, updateSectionStatus } from "@/app/(app)/repertoire/section-actions";
import { flattenSections } from "@/lib/section-utils";
import type { TimerTarget, PieceSection, SectionStatus } from "@/lib/types";

export function ScrubberBar() {
  const isZenMode = useZenMode();
  const pathname = usePathname();
  const {
    isRunning,
    currentTarget,
    focusedTarget,
    setFocusedTarget,
    activePieces,
    switchTarget,
  } = useTimer();
  const video = useVideo();

  const activeTarget = isRunning ? currentTarget : focusedTarget;
  const activePieceId =
    activeTarget?.category === "piece" ? activeTarget.pieceId : null;

  // Load video data when focused piece changes
  const [sections, setSections] = useState<PieceSection[]>([]);
  const [loadedPieceId, setLoadedPieceId] = useState<string | null>(null);

  useEffect(() => {
    if (!activePieceId) {
      if (video.videoPieceId) video.clearVideo();
      setSections([]);
      setLoadedPieceId(null);
      return;
    }
    if (activePieceId === loadedPieceId) return;

    let cancelled = false;
    (async () => {
      await video.loadPieceVideo(activePieceId);
      const sectionData = await getSections(activePieceId);
      if (!cancelled) {
        setSections(flattenSections(sectionData));
        setLoadedPieceId(activePieceId);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePieceId]);

  const showScrubber =
    activePieceId &&
    video.videoId &&
    video.timestamps.length > 0 &&
    sections.length > 0;

  const videoEnd = video.videoEnd ?? video.duration;

  const activePiece = activePieceId
    ? activePieces.find((p) => p.id === activePieceId)
    : null;

  const handleScrubberSectionClick = (sectionId: string) => {
    if (!activeTarget || activeTarget.category !== "piece") return;

    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    // Build section target
    const sectionTarget: TimerTarget = {
      category: "piece",
      pieceId: activeTarget.pieceId,
      pieceName: activeTarget.pieceName,
      composer: activeTarget.composer,
      sectionId: section.id,
      sectionLabel: section.label,
    };

    // Switch timer to this section
    if (isRunning) {
      switchTarget(sectionTarget);
    } else {
      setFocusedTarget(sectionTarget);
    }
  };

  // Listen for optimistic status updates from other components (e.g. sidebar)
  useEffect(() => {
    const handler = (e: Event) => {
      const { sectionId, status } = (e as CustomEvent).detail;
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, status } : s))
      );
    };
    window.addEventListener("section-status-changed", handler);
    return () => window.removeEventListener("section-status-changed", handler);
  }, []);

  const handleStatusCycle = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const next = ((section.status + 1) % 9) as SectionStatus;
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, status: next } : s))
    );
    updateSectionStatus(sectionId, next);
    window.dispatchEvent(new CustomEvent("section-status-changed", { detail: { sectionId, status: next } }));
  };

  const activeSectionId =
    activeTarget?.category === "piece" ? activeTarget.sectionId : undefined;

  if (isZenMode) return null;
  if (pathname !== "/" && !isRunning) return null;
  if (!showScrubber) return null;

  return (
    <div className="sticky top-26 z-30 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b">
      <div className="mx-auto max-w-7xl px-4 py-1.5 sm:px-6">
        <SectionScrubber
          sections={sections}
          timestamps={video.timestamps}
          videoStart={video.videoStart}
          videoEnd={videoEnd}
          currentTime={video.currentTime}
          activeSectionId={activeSectionId}
          pieceTargetTempo={activePiece?.target_tempo}
          onSectionClick={handleScrubberSectionClick}
          onStatusCycle={handleStatusCycle}
        />
      </div>
    </div>
  );
}
