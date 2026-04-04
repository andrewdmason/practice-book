"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ExternalLinkIcon,
  MusicIcon,
  PencilIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { useTimer } from "@/components/timer/timer-context";
import { TimeSummary } from "@/components/timer/time-summary";
import { getTodaySummary } from "@/app/(app)/timer/actions";
import {
  getCategoryFocusData,
  getAllOpenAssignments,
  getPieceFocusData,
  updateAssignmentProgress,
  updateAssignmentNote,
} from "@/app/(app)/focus-panel/actions";
import type { AssignmentWithPiece } from "@/app/(app)/focus-panel/actions";
import { getSections } from "@/app/(app)/repertoire/section-actions";
import { getNextBounceProgress } from "@/lib/progress-bounce";
import { createClient } from "@/lib/supabase/client";
import { useMetronome } from "@/components/metronome/metronome-context";
import { SectionSidebar } from "@/components/timer/section-sidebar";
import { YouTubePlayer } from "@/components/video/youtube-player";
import { useVideo } from "@/components/video/video-context";
import { TIMER_CATEGORY_LABELS } from "@/lib/timer-utils";
import type {
  Piece,
  PieceSectionWithChildren,
  SectionStatus,
  Assignment,
  TimerTarget,
  TimeSummaryEntry,
} from "@/lib/types";

export function RepertoireFocusPanel() {
  const router = useRouter();
  const { isRunning, currentTarget, focusedTarget, setFocusedTarget, activePieces } = useTimer();

  // Determine active target: timer target when running, focused target from pills otherwise
  const activeTarget = isRunning ? currentTarget : focusedTarget;

  const activePieceId =
    activeTarget?.category === "piece" ? activeTarget.pieceId : null;

  const handleFocusItem = useCallback(
    (focusKey: string) => {
      if (isRunning) return;
      let target: TimerTarget;
      if (focusKey === "technique") {
        target = { category: "technique" };
      } else if (focusKey === "sight_reading") {
        target = { category: "sight_reading" };
      } else {
        const piece = activePieces.find((p) => p.id === focusKey);
        if (!piece) return;
        target = {
          category: "piece",
          pieceId: piece.id,
          pieceName: piece.name,
          composer: piece.composer,
        };
      }
      setFocusedTarget(target);
      // Use history.replaceState to update URL without triggering server re-render
      window.history.replaceState(null, "", `/?focus=${focusKey}`);
    },
    [isRunning, activePieces, setFocusedTarget]
  );

  let content: React.ReactNode;

  if (activePieceId) {
    const activePiece = activePieces.find((p) => p.id === activePieceId);
    content = <PieceDetail pieceId={activePieceId} knownPiece={activePiece ?? null} />;
  } else {
    const activeCategory = activeTarget?.category !== "piece" ? activeTarget?.category : null;

    if (activeCategory === "technique" || activeCategory === "sight_reading") {
      content = <CategoryDetail category={activeCategory} />;
    } else {
      content = (
        <PracticeOverview
          isRunning={isRunning}
          onFocusItem={handleFocusItem}
          activePieces={activePieces}
        />
      );
    }
  }

  return (
    <>
      {content}
      <FloatingVideoPanel />
    </>
  );
}

// ---------------------------------------------------------------------------
// Piece Detail
// ---------------------------------------------------------------------------

function PieceDetail({ pieceId, knownPiece }: { pieceId: string; knownPiece: Piece | null }) {
  const [piece, setPiece] = useState<{
    name: string;
    composer: string | null;
    target_tempo: number | null;
  } | null>(knownPiece ? { name: knownPiece.name, composer: knownPiece.composer, target_tempo: knownPiece.target_tempo } : null);
  const [openAssignments, setOpenAssignments] = useState<Assignment[]>([]);
  const [completedAssignments, setCompletedAssignments] = useState<Assignment[]>([]);
  const [sections, setSections] = useState<PieceSectionWithChildren[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Update piece immediately when knownPiece changes (no network needed)
  useEffect(() => {
    if (knownPiece) {
      setPiece({ name: knownPiece.name, composer: knownPiece.composer, target_tempo: knownPiece.target_tempo });
    }
  }, [knownPiece]);

  const refreshAssignments = useCallback(() => {
    getPieceFocusData(pieceId).then((data) => {
      setOpenAssignments(data.openAssignments);
      setCompletedAssignments(data.completedAssignments);
      setLoaded(true);
    });
  }, [pieceId]);

  const refreshSections = useCallback(() => {
    getSections(pieceId).then(setSections);
  }, [pieceId]);

  useEffect(() => {
    // Don't reset loaded if we already have assignments — keep stale data visible while refreshing
    if (openAssignments.length === 0 && completedAssignments.length === 0) {
      setLoaded(false);
    }

    // Only fetch piece metadata from DB if not provided via props (e.g. deep link)
    if (!knownPiece) {
      const supabase = createClient();
      supabase
        .from("pieces")
        .select("name, composer, target_tempo")
        .eq("id", pieceId)
        .single()
        .then(({ data }) => {
          if (data) {
            setPiece({ name: data.name, composer: data.composer, target_tempo: data.target_tempo });
          }
        });
    }

    refreshAssignments();
    refreshSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceId, refreshAssignments]);

  useEffect(() => {
    const handler = () => refreshAssignments();
    window.addEventListener("assignments-changed", handler);
    return () => window.removeEventListener("assignments-changed", handler);
  }, [refreshAssignments]);

  useEffect(() => {
    const handler = () => refreshSections();
    window.addEventListener("sections-changed", handler);
    return () => window.removeEventListener("sections-changed", handler);
  }, [refreshSections]);

  // Optimistically apply status changes from other components (e.g. scrubber bar)
  useEffect(() => {
    const handler = (e: Event) => {
      const { sectionId, status } = (e as CustomEvent).detail;
      setSections((prev) =>
        prev.map((s) => {
          if (s.id === sectionId) return { ...s, status };
          return {
            ...s,
            children: s.children.map((c) =>
              c.id === sectionId ? { ...c, status } : c
            ),
          };
        })
      );
    };
    window.addEventListener("section-status-changed", handler);
    return () => window.removeEventListener("section-status-changed", handler);
  }, []);

  const handleProgressChange = (assignmentId: string, progress: number) => {
    if (progress === 4) {
      // Move from open to completed
      const assignment = openAssignments.find((t) => t.id === assignmentId);
      if (assignment) {
        const updated = { ...assignment, progress, completed_at: new Date().toISOString() };
        setOpenAssignments((prev) => prev.filter((t) => t.id !== assignmentId));
        setCompletedAssignments((prev) => [updated, ...prev]);
      }
    } else {
      // Could be un-completing from completed list or updating open assignment progress
      const completedAssignment = completedAssignments.find((t) => t.id === assignmentId);
      if (completedAssignment) {
        const updated = { ...completedAssignment, progress, completed_at: null };
        setCompletedAssignments((prev) => prev.filter((t) => t.id !== assignmentId));
        setOpenAssignments((prev) => [updated, ...prev]);
      } else {
        setOpenAssignments((prev) =>
          prev.map((t) => t.id === assignmentId ? { ...t, progress } : t)
        );
      }
    }
  };

  const handleNoteChange = (assignmentId: string, note: string | null) => {
    setOpenAssignments((prev) =>
      prev.map((t) => t.id === assignmentId ? { ...t, note } : t)
    );
    setCompletedAssignments((prev) =>
      prev.map((t) => t.id === assignmentId ? { ...t, note } : t)
    );
  };

  if (!piece) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="text-sm">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const hasAssignments = loaded && (openAssignments.length > 0 || completedAssignments.length > 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base flex-1 min-w-0">
              <span className="truncate">{piece.name}</span>
              {piece.composer && (
                <span className="text-sm font-normal text-muted-foreground ml-1.5">
                  {piece.composer}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-1 shrink-0">
              <PieceVideoToggle />
              <Link
                href={`/repertoire/${pieceId}`}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                title="Open repertoire page"
              >
                <ExternalLinkIcon className="size-3.5" />
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sections */}
          {sections.length > 0 && (
            <SectionSidebar
              sections={sections}
              pieceTargetTempo={piece.target_tempo}
              pieceId={pieceId}
              pieceName={piece.name}
              composer={piece.composer}
              onSectionsChanged={refreshSections}
              onStatusChange={(sectionId, status) => {
                setSections((prev) =>
                  prev.map((s) => {
                    if (s.id === sectionId) return { ...s, status };
                    return {
                      ...s,
                      children: s.children.map((c) =>
                        c.id === sectionId ? { ...c, status } : c
                      ),
                    };
                  })
                );
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Assignments in separate card */}
      {hasAssignments && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            {/* Open Assignments */}
            {openAssignments.length > 0 && (
              <FocusSection
                icon={<CheckCircle2Icon className="size-3.5" />}
                title="Assignments"
                count={openAssignments.length}
              >
                {openAssignments.map((assignment) => (
                  <AssignmentRow
                    key={assignment.id}
                    assignment={assignment}
                    onProgressChange={(progress) => handleProgressChange(assignment.id, progress)}
                    onNoteChange={(note) => handleNoteChange(assignment.id, note)}
                  />
                ))}
              </FocusSection>
            )}

            {/* Completed Assignments (collapsible) */}
            {completedAssignments.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
                >
                  <ChevronDownIcon className={`size-3.5 transition-transform ${showCompleted ? "" : "-rotate-90"}`} />
                  Completed
                  <span className="text-[10px] font-normal bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                    {completedAssignments.length}
                  </span>
                </button>
                {showCompleted && (
                  <div className="space-y-1.5">
                    {completedAssignments.map((assignment) => (
                      <AssignmentRow
                        key={assignment.id}
                        assignment={assignment}
                        onProgressChange={(progress) => handleProgressChange(assignment.id, progress)}
                        onNoteChange={(note) => handleNoteChange(assignment.id, note)}
                        showCompletedDate
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Piece Video (floating bottom-left panel)
// ---------------------------------------------------------------------------

function PieceVideoToggle() {
  const { videoId, showVideo, setShowVideo } = useVideo();
  if (!videoId) return null;
  return (
    <button
      type="button"
      onClick={() => setShowVideo(!showVideo)}
      className={`p-1 transition-colors ${showVideo ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
      title={showVideo ? "Hide video" : "Show video"}
    >
      <VideoIcon className="size-3.5" />
    </button>
  );
}

function FloatingVideoPanel() {
  const { videoId, showVideo, setShowVideo } = useVideo();
  const [width, setWidth] = useState(320);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const interactionRef = useRef<
    | { type: "drag"; startMouseX: number; startMouseY: number; startX: number; startY: number }
    | { type: "resize"; startMouseX: number; startWidth: number }
    | null
  >(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Only drag from title bar, not buttons
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const pos = position ?? { x: 16, y: window.innerHeight - 16 - Math.round(320 * 9 / 16) - 24 };
    interactionRef.current = {
      type: "drag",
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };

    const handleMove = (ev: MouseEvent) => {
      const ref = interactionRef.current;
      if (!ref || ref.type !== "drag") return;
      setPosition({
        x: ref.startX + (ev.clientX - ref.startMouseX),
        y: ref.startY + (ev.clientY - ref.startMouseY),
      });
    };

    const handleUp = () => {
      interactionRef.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [position]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    interactionRef.current = {
      type: "resize",
      startMouseX: e.clientX,
      startWidth: width,
    };

    const handleMove = (ev: MouseEvent) => {
      const ref = interactionRef.current;
      if (!ref || ref.type !== "resize") return;
      const delta = ev.clientX - ref.startMouseX;
      setWidth(Math.max(240, Math.min(640, ref.startWidth + delta)));
    };

    const handleUp = () => {
      interactionRef.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [width]);

  if (!videoId || !showVideo) return null;

  const height = Math.round(width * 9 / 16);
  const titleBarHeight = 24;
  const panelHeight = height + titleBarHeight;

  return (
    <div
      className="fixed z-50 rounded-lg overflow-hidden shadow-lg border bg-card"
      style={position
        ? { width, left: position.x, top: position.y }
        : { width, left: 16, bottom: 16 }
      }
    >
      <div
        onMouseDown={handleDragStart}
        className="flex items-center justify-between px-2 py-1 bg-muted/50 cursor-grab active:cursor-grabbing select-none"
      >
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Video</span>
        <button
          type="button"
          onClick={() => setShowVideo(false)}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <XIcon className="size-3" />
        </button>
      </div>
      <div style={{ height }} className="relative bg-black">
        <YouTubePlayer bare />
      </div>
      {/* Resize handle on right edge */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize hover:bg-primary/20 transition-colors"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Focus Section wrapper
// ---------------------------------------------------------------------------

function FocusSection({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {icon}
        {title}
        {count !== undefined && count > 0 && (
          <span className="ml-auto text-[10px] font-normal bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
            {count}
          </span>
        )}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row components
// ---------------------------------------------------------------------------

function AssignmentTextWithMetronome({ text }: { text: string }) {
  const { start } = useMetronome();
  const parts = text.split(/(♩=\d+)/);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^♩=(\d+)$/);
        if (match) {
          const bpm = parseInt(match[1], 10);
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                start(bpm);
              }}
              className="inline-flex items-center rounded-md bg-secondary px-1 py-0.5 font-mono text-xs text-secondary-foreground cursor-pointer hover:bg-secondary/80 transition-colors"
            >
              ♩={bpm}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function AssignmentRow({
  assignment,
  onProgressChange,
  onNoteChange,
  showCompletedDate,
}: {
  assignment: Assignment;
  onProgressChange: (progress: number) => void;
  onNoteChange: (note: string | null) => void;
  showCompletedDate?: boolean;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(assignment.note ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    let newProgress: number;
    if (e.altKey) {
      newProgress = (assignment.progress + 1) % 5;
    } else {
      newProgress = assignment.progress === 4 ? 0 : 4;
    }
    onProgressChange(newProgress);
    updateAssignmentProgress(assignment.id, newProgress);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const newProgress = getNextBounceProgress(assignment.id, assignment.progress);
    onProgressChange(newProgress);
    updateAssignmentProgress(assignment.id, newProgress);
  };

  const handleNoteSave = () => {
    setEditingNote(false);
    const trimmed = noteValue.trim() || null;
    if (trimmed !== assignment.note) {
      onNoteChange(trimmed);
      // Notify editor AssignmentItemViews of the note change
      window.dispatchEvent(
        new CustomEvent("assignment-note-updated", {
          detail: { taskId: assignment.id, note: trimmed },
        })
      );
      updateAssignmentNote(assignment.id, trimmed);
    }
  };

  useEffect(() => {
    if (editingNote && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingNote]);

  return (
    <div className="group">
      <div className="flex items-start gap-2 text-sm">
        <button
          type="button"
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          className="mt-0.5 shrink-0 text-primary"
        >
          <ProgressCircle progress={assignment.progress} size={16} />
        </button>
        <span className={`flex-1 ${assignment.progress === 4 ? "line-through text-muted-foreground" : ""}`}>
          <AssignmentTextWithMetronome text={assignment.text} />
        </span>
        <button
          type="button"
          onClick={() => {
            const el = document.querySelector(`[data-task-id="${assignment.id}"]`);
            if (el) {
              document.querySelectorAll(".assignment-highlight").forEach((prev) => prev.classList.remove("assignment-highlight"));
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              void (el as HTMLElement).offsetWidth;
              el.classList.add("assignment-highlight");
              el.addEventListener("animationend", () => el.classList.remove("assignment-highlight"), { once: true });
            }
          }}
          className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
          title="Jump to assignment in feed"
        >
          <ArrowRightIcon className="size-3" />
        </button>
        {!editingNote && !assignment.note && (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0 mt-0.5"
          >
            <PencilIcon className="size-3" />
          </button>
        )}
      </div>
      {/* Existing note display */}
      {assignment.note && !editingNote && (
        <p
          className="ml-6 mt-0.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={() => {
            setNoteValue(assignment.note ?? "");
            setEditingNote(true);
          }}
        >
          {assignment.note}
        </p>
      )}
      {/* Note editing */}
      {editingNote && (
        <textarea
          ref={textareaRef}
          value={noteValue}
          onChange={(e) => setNoteValue(e.target.value)}
          onBlur={handleNoteSave}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleNoteSave();
            }
            if (e.key === "Escape") {
              setEditingNote(false);
              setNoteValue(assignment.note ?? "");
            }
          }}
          className="ml-6 mt-1 w-[calc(100%-1.5rem)] rounded border bg-background px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          rows={2}
          placeholder="Add a note..."
        />
      )}
      {/* Completed date */}
      {showCompletedDate && assignment.completed_at && (
        <p className="ml-6 mt-0.5 text-[10px] text-muted-foreground/70">
          Completed {formatDate(assignment.completed_at.slice(0, 10))}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Detail (sidebar when a category like technique/sight_reading is focused)
// ---------------------------------------------------------------------------

function CategoryDetail({
  category,
}: {
  category: "technique" | "sight_reading";
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loaded, setLoaded] = useState(false);

  const label = TIMER_CATEGORY_LABELS[category] ?? category;

  const refreshAssignments = useCallback(() => {
    getCategoryFocusData(category).then((data) => {
      setAssignments(data.assignments);
      setLoaded(true);
    });
  }, [category]);

  useEffect(() => {
    setLoaded(false);
    refreshAssignments();
  }, [refreshAssignments]);

  useEffect(() => {
    const handler = () => refreshAssignments();
    window.addEventListener("assignments-changed", handler);
    return () => window.removeEventListener("assignments-changed", handler);
  }, [refreshAssignments]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MusicIcon className="size-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loaded && assignments.length > 0 && (
          <FocusSection
            icon={<CheckCircle2Icon className="size-3.5" />}
            title="Assignments"
            count={assignments.filter((t) => t.progress < 4).length}
          >
            {assignments.map((assignment) => (
              <AssignmentRow key={assignment.id} assignment={assignment} onProgressChange={(progress) => {
                setAssignments((prev) =>
                  prev.map((t) => t.id === assignment.id ? { ...t, progress } : t)
                );
              }} onNoteChange={(note) => {
                setAssignments((prev) =>
                  prev.map((t) => t.id === assignment.id ? { ...t, note } : t)
                );
              }} />
            ))}
          </FocusSection>
        )}
        {loaded && assignments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No assignments yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Practice Overview (sidebar when no piece/category is focused)
// ---------------------------------------------------------------------------

function PracticeOverview({
  isRunning,
  onFocusItem,
  activePieces,
}: {
  isRunning: boolean;
  onFocusItem: (focusKey: string) => void;
  activePieces: Piece[];
}) {
  const [summary, setSummary] = useState<TimeSummaryEntry[]>([]);
  const [allAssignments, setAllAssignments] = useState<AssignmentWithPiece[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refreshData = useCallback(() => {
    Promise.all([getTodaySummary(), getAllOpenAssignments()]).then(
      ([summaryData, assignmentsData]) => {
        setSummary(summaryData);
        setAllAssignments(assignmentsData);
        setLoaded(true);
      }
    );
  }, []);

  useEffect(() => {
    refreshData();
  }, [isRunning, refreshData]);

  useEffect(() => {
    const handler = () => refreshData();
    window.addEventListener("assignments-changed", handler);
    return () => window.removeEventListener("assignments-changed", handler);
  }, [refreshData]);

  const handleProgressChange = (assignmentId: string, progress: number) => {
    if (progress === 4) {
      setAllAssignments((prev) => prev.filter((t) => t.id !== assignmentId));
    } else {
      setAllAssignments((prev) =>
        prev.map((t) => (t.id === assignmentId ? { ...t, progress } : t))
      );
    }
  };

  const handleNoteChange = (assignmentId: string, note: string | null) => {
    setAllAssignments((prev) =>
      prev.map((t) => (t.id === assignmentId ? { ...t, note } : t))
    );
  };

  if (!loaded) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="text-sm">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  // Group assignments by piece or category
  type AssignmentGroup = { key: string; label: string; subtitle: string | null; focusKey: string; assignments: AssignmentWithPiece[] };
  const pieceGroups = new Map<string, AssignmentGroup>();
  const categoryGroups = new Map<string, AssignmentGroup>();
  for (const assignment of allAssignments) {
    if (assignment.piece_id && assignment.piece_name) {
      const group = pieceGroups.get(assignment.piece_id);
      if (group) {
        group.assignments.push(assignment);
      } else {
        pieceGroups.set(assignment.piece_id, {
          key: assignment.piece_id,
          label: assignment.piece_name,
          subtitle: assignment.piece_composer,
          focusKey: assignment.piece_id,
          assignments: [assignment],
        });
      }
    } else {
      const cat = assignment.section_category ?? "other";
      const group = categoryGroups.get(cat);
      if (group) {
        group.assignments.push(assignment);
      } else {
        const label = TIMER_CATEGORY_LABELS[cat as keyof typeof TIMER_CATEGORY_LABELS] ?? cat;
        categoryGroups.set(cat, {
          key: cat,
          label,
          subtitle: null,
          focusKey: cat,
          assignments: [assignment],
        });
      }
    }
  }

  // Sort piece groups by activePieces order (sort_order, then name)
  const pieceOrder = new Map(activePieces.map((p, i) => [p.id, i]));
  const sortedPieceGroups = [...pieceGroups.values()].sort(
    (a, b) => (pieceOrder.get(a.key) ?? Infinity) - (pieceOrder.get(b.key) ?? Infinity)
  );

  // Categories before pieces: technique, then sight_reading, then any others
  const categoryOrder: Record<string, number> = { technique: 0, sight_reading: 1 };
  const sortedCategoryGroups = [...categoryGroups.values()].sort(
    (a, b) => (categoryOrder[a.key] ?? 99) - (categoryOrder[b.key] ?? 99)
  );

  const allGroups = [...sortedCategoryGroups, ...sortedPieceGroups];

  return (
    <div className="space-y-4">
      {allAssignments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2Icon className="size-4" />
              Active Assignments
              <span className="text-xs font-normal bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                {allAssignments.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {allGroups.map((group) => (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => onFocusItem(group.focusKey)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-1.5 flex items-center gap-1"
                >
                  {group.label}
                  {group.subtitle && (
                    <span className="font-normal">— {group.subtitle}</span>
                  )}
                </button>
                <div className="space-y-1.5">
                  {group.assignments.map((assignment) => (
                    <AssignmentRow
                      key={assignment.id}
                      assignment={assignment}
                      onProgressChange={(progress) => handleProgressChange(assignment.id, progress)}
                      onNoteChange={(note) => handleNoteChange(assignment.id, note)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {summary.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Repertoire</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Today&apos;s Practice
              </h4>
              <TimeSummary entries={summary} onItemClick={onFocusItem} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
