"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { useZenMode } from "@/components/layout/zen-mode-context";
import { useVideo } from "@/components/video/video-context";
import { SectionScrubber } from "@/components/layout/section-scrubber";
import { getSections, updateSectionStatus } from "@/app/(app)/repertoire/section-actions";
import { flattenSections, practiceTempo } from "@/lib/section-utils";
import { useMetronome } from "@/components/metronome/metronome-context";
import type { PieceSection, SectionStatus, PieceKind } from "@/lib/types";

export function ScrubberBar() {
  const isZenMode = useZenMode();
  const pathname = usePathname();
  const {
    focusedPieceId,
    activePieces,
  } = useTaskTimer();
  const video = useVideo();
  const { start: startMetronome, isActive: metronomeActive } = useMetronome();

  const activePiece = focusedPieceId
    ? activePieces.find((p) => p.id === focusedPieceId)
    : null;
  const activePieceId =
    activePiece && (activePiece.kind as PieceKind) === "piece"
      ? activePiece.id
      : null;

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

  // Listen for optimistic status updates from other components
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

  const handleStatusCycle = (sectionId: string, reverse = false) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const next = (reverse
      ? ((section.status + 8) % 9)
      : ((section.status + 1) % 9)) as SectionStatus;
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, status: next } : s))
    );
    updateSectionStatus(sectionId, next, { pieceId: activePieceId! });
    window.dispatchEvent(new CustomEvent("section-status-changed", { detail: { sectionId, status: next } }));
    if (metronomeActive) {
      const effectiveTempo = section.target_tempo ?? activePiece?.target_tempo ?? null;
      const newTempo = practiceTempo(next, effectiveTempo);
      if (newTempo) startMetronome(newTempo);
    }
  };

  if (isZenMode) return null;
  if (pathname !== "/") return null;
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
          activeSectionId={undefined}
          pieceTargetTempo={activePiece?.target_tempo}
          onSectionClick={() => {}}
          onStatusCycle={handleStatusCycle}
          onStatusCycleReverse={(sectionId) => handleStatusCycle(sectionId, true)}
        />
      </div>
    </div>
  );
}
