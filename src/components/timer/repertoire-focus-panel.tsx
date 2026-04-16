"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ExternalLinkIcon,
  PlusIcon,
  Trash2Icon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { TimeSummary } from "@/components/timer/time-summary";
import { getTodaySummary } from "@/app/(app)/timer/actions";
import {
  getAllOpenAssignments,
  getAssignmentsForPiece,
  toggleAssignmentCompleted,
  createAssignment,
  deleteAssignment,
  updateAssignmentText,
} from "@/app/(app)/focus-panel/actions";
import type { AssignmentWithPiece } from "@/app/(app)/focus-panel/actions";
import { getSections } from "@/app/(app)/repertoire/section-actions";
import { createTaskOptimistic } from "@/lib/optimistic-task";
import { createClient } from "@/lib/supabase/client";
import { useMetronome } from "@/components/metronome/metronome-context";
import { SectionSidebar } from "@/components/timer/section-sidebar";
import { YouTubePlayer } from "@/components/video/youtube-player";
import { useVideo } from "@/components/video/video-context";
import type {
  Piece,
  PieceKind,
  PieceSectionWithChildren,
  Assignment,
  TimeSummaryEntry,
} from "@/lib/types";
import { TECHNIQUE_PIECE_ID, SIGHT_READING_PIECE_ID } from "@/lib/types";
import { localDate } from "@/lib/date-utils";

// Client-side caches so re-selecting a piece shows data instantly
const sectionsCache = new Map<string, PieceSectionWithChildren[]>();
const assignmentsCache = new Map<string, { openAssignments: Assignment[]; completedAssignments: Assignment[] }>();

export function RepertoireFocusPanel() {
  const { focusedPieceId, setFocusedPieceId, activePieces, activeTaskId } = useTaskTimer();

  const activePieceId = focusedPieceId;

  const handleFocusItem = useCallback(
    (focusKey: string) => {
      setFocusedPieceId(focusKey);
      window.history.replaceState(null, "", `/?focus=${focusKey}`);
    },
    [setFocusedPieceId]
  );

  let content: React.ReactNode;

  if (activePieceId) {
    const activePiece = activePieces.find((p) => p.id === activePieceId);
    content = <PieceDetail pieceId={activePieceId} knownPiece={activePiece ?? null} />;
  } else {
    content = (
      <PracticeOverview
        isRunning={activeTaskId !== null}
        onFocusItem={handleFocusItem}
        activePieces={activePieces}
      />
    );
  }

  return (
    <>
      {content}
      <FloatingVideoPanel />
    </>
  );
}

// ---------------------------------------------------------------------------
// Piece Detail (handles both regular pieces and system pieces like technique)
// ---------------------------------------------------------------------------

function isSystemPiece(pieceId: string): boolean {
  return pieceId === TECHNIQUE_PIECE_ID || pieceId === SIGHT_READING_PIECE_ID;
}

function PieceDetail({ pieceId, knownPiece }: { pieceId: string; knownPiece: Piece | null }) {
  const cached = assignmentsCache.get(pieceId);
  const [piece, setPiece] = useState<{
    name: string;
    composer: string | null;
    target_tempo: number | null;
    kind: PieceKind;
  } | null>(knownPiece ? { name: knownPiece.name, composer: knownPiece.composer, target_tempo: knownPiece.target_tempo, kind: (knownPiece.kind ?? "piece") as PieceKind } : null);
  const [openAssignments, setOpenAssignments] = useState<Assignment[]>(cached?.openAssignments ?? []);
  const [completedAssignments, setCompletedAssignments] = useState<Assignment[]>(cached?.completedAssignments ?? []);
  const [sections, setSections] = useState<PieceSectionWithChildren[]>(
    () => sectionsCache.get(pieceId) ?? []
  );
  const [showCompleted, setShowCompleted] = useState(false);
  const [loaded, setLoaded] = useState(!!cached);
  const [newAssignmentText, setNewAssignmentText] = useState("");

  // Update piece immediately when knownPiece changes (no network needed)
  useEffect(() => {
    if (knownPiece) {
      setPiece({ name: knownPiece.name, composer: knownPiece.composer, target_tempo: knownPiece.target_tempo, kind: (knownPiece.kind ?? "piece") as PieceKind });
    }
  }, [knownPiece]);

  const refreshAssignments = useCallback(() => {
    getAssignmentsForPiece(pieceId).then((data) => {
      assignmentsCache.set(pieceId, data);
      setOpenAssignments(data.openAssignments);
      setCompletedAssignments(data.completedAssignments);
      setLoaded(true);
    });
  }, [pieceId]);

  const refreshSections = useCallback(() => {
    getSections(pieceId).then((data) => {
      sectionsCache.set(pieceId, data);
      setSections(data);
    }).catch(() => {
      getSections(pieceId).then((data) => {
        sectionsCache.set(pieceId, data);
        setSections(data);
      }).catch(() => {});
    });
  }, [pieceId]);

  useEffect(() => {
    const cachedSections = sectionsCache.get(pieceId);
    if (cachedSections) setSections(cachedSections);
    const cachedAssignments = assignmentsCache.get(pieceId);
    if (cachedAssignments) {
      setOpenAssignments(cachedAssignments.openAssignments);
      setCompletedAssignments(cachedAssignments.completedAssignments);
      setLoaded(true);
    } else {
      setLoaded(false);
    }

    if (!knownPiece) {
      const supabase = createClient();
      supabase
        .from("pieces")
        .select("name, composer, target_tempo, kind")
        .eq("id", pieceId)
        .single()
        .then(({ data }) => {
          if (data) {
            setPiece({ name: data.name, composer: data.composer, target_tempo: data.target_tempo, kind: data.kind as PieceKind });
          }
        });
    }

    refreshAssignments();
    if (!isSystemPiece(pieceId)) {
      refreshSections();
    }
  }, [pieceId, refreshAssignments, refreshSections, knownPiece]);

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

  useEffect(() => {
    const handler = (e: Event) => {
      const { sectionId, status } = (e as CustomEvent).detail;
      setSections((prev) => {
        const next = prev.map((s) => {
          if (s.id === sectionId) return { ...s, status };
          return {
            ...s,
            children: s.children.map((c) =>
              c.id === sectionId ? { ...c, status } : c
            ),
          };
        });
        sectionsCache.set(pieceId, next);
        return next;
      });
    };
    window.addEventListener("section-status-changed", handler);
    return () => window.removeEventListener("section-status-changed", handler);
  }, []);

  const handleToggle = async (assignment: Assignment) => {
    const newCompleted = !assignment.completed;
    if (newCompleted) {
      const updated = { ...assignment, completed: true, completed_at: new Date().toISOString() };
      setOpenAssignments((prev) => prev.filter((t) => t.id !== assignment.id));
      setCompletedAssignments((prev) => [updated, ...prev]);
    } else {
      const updated = { ...assignment, completed: false, completed_at: null };
      setCompletedAssignments((prev) => prev.filter((t) => t.id !== assignment.id));
      setOpenAssignments((prev) => [updated, ...prev]);
    }
    await toggleAssignmentCompleted(assignment.id, newCompleted);
  };

  const handleCreate = async () => {
    const text = newAssignmentText.trim();
    if (!text) return;
    setNewAssignmentText("");
    const tempId = crypto.randomUUID();
    const temp: Assignment = {
      id: tempId,
      piece_id: pieceId,
      text,
      completed: false,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setOpenAssignments((prev) => [temp, ...prev]);
    await createAssignment(pieceId, text);
    refreshAssignments();
  };

  const handleDelete = async (assignmentId: string) => {
    setOpenAssignments((prev) => prev.filter((t) => t.id !== assignmentId));
    setCompletedAssignments((prev) => prev.filter((t) => t.id !== assignmentId));
    await deleteAssignment(assignmentId);
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

  const systemPiece = isSystemPiece(pieceId);
  const hasAssignments = loaded && (openAssignments.length > 0 || completedAssignments.length > 0);

  return (
    <div className="space-y-4">
      {/* Piece header card */}
      <Card>
        <CardHeader className="pb-0">
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
              {!systemPiece && <PieceVideoToggle />}
              {!systemPiece && (
                <Link
                  href={`/repertoire/${pieceId}`}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Open repertoire page"
                >
                  <ExternalLinkIcon className="size-3.5" />
                </Link>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sections card (only for regular pieces) */}
      {!systemPiece && sections.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <SectionSidebar
              sections={sections}
              pieceTargetTempo={piece.target_tempo}
              pieceId={pieceId}
              pieceName={piece.name}
              composer={piece.composer}
              onSectionsChanged={refreshSections}
              onStatusChange={(sectionId, status) => {
                setSections((prev) => {
                  const next = prev.map((s) => {
                    if (s.id === sectionId) return { ...s, status };
                    return {
                      ...s,
                      children: s.children.map((c) =>
                        c.id === sectionId ? { ...c, status } : c
                      ),
                    };
                  });
                  sectionsCache.set(pieceId, next);
                  return next;
                });
              }}
              onAddTask={(section, metronomeSpeed, tomorrow) => {
                const date = tomorrow
                  ? localDate(new Date(Date.now() + 86_400_000))
                  : localDate();
                void createTaskOptimistic({
                  pieceId,
                  sectionId: section.id,
                  date,
                  metronomeSpeed,
                  pieceName: piece.name,
                  pieceComposer: piece.composer,
                  pieceKind: piece.kind,
                  sectionLabel: section.label,
                  sectionStatus: section.status,
                });
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Assignments card */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* New assignment input */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={newAssignmentText}
              onChange={(e) => setNewAssignmentText(e.target.value)}
              placeholder="Add assignment..."
              className="flex-1 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={!newAssignmentText.trim()}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            >
              <PlusIcon className="size-4" />
            </button>
          </form>

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
                  onToggle={() => handleToggle(assignment)}
                  onDelete={() => handleDelete(assignment.id)}
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
                      onToggle={() => handleToggle(assignment)}
                      onDelete={() => handleDelete(assignment.id)}
                      showCompletedDate
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {loaded && openAssignments.length === 0 && completedAssignments.length === 0 && (
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          )}
        </CardContent>
      </Card>
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
  onToggle,
  onDelete,
  showCompletedDate,
}: {
  assignment: Assignment;
  onToggle: () => void;
  onDelete: () => void;
  showCompletedDate?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(assignment.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(assignment.text);
  }, [assignment.text]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setText(assignment.text);
      setEditing(false);
      return;
    }
    if (trimmed !== assignment.text) {
      void updateAssignmentText(assignment.id, trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setText(assignment.text);
    setEditing(false);
  };

  return (
    <div className="group">
      <div className="flex items-start gap-2 text-sm">
        <button
          type="button"
          onClick={onToggle}
          className="mt-0.5 shrink-0"
        >
          <div className={`size-4 rounded-full border-2 flex items-center justify-center transition-colors ${
            assignment.completed
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/40 hover:border-primary"
          }`}>
            {assignment.completed && (
              <svg className="size-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </div>
        </button>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            className="flex-1 rounded border bg-background px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <button
            type="button"
            onClick={() => !assignment.completed && setEditing(true)}
            className={`flex-1 text-left cursor-text ${
              assignment.completed ? "line-through text-muted-foreground" : ""
            }`}
          >
            <AssignmentTextWithMetronome text={assignment.text} />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 mt-0.5"
          title="Delete assignment"
        >
          <Trash2Icon className="size-3" />
        </button>
      </div>
      {showCompletedDate && assignment.completed_at && (
        <p className="ml-6 mt-0.5 text-[10px] text-muted-foreground/70">
          Completed {formatDate(assignment.completed_at.slice(0, 10))}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Practice Overview (sidebar when no piece is focused)
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

  const handleToggle = async (assignmentId: string) => {
    setAllAssignments((prev) => prev.filter((t) => t.id !== assignmentId));
    await toggleAssignmentCompleted(assignmentId, true);
  };

  const handleDelete = async (assignmentId: string) => {
    setAllAssignments((prev) => prev.filter((t) => t.id !== assignmentId));
    await deleteAssignment(assignmentId);
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

  // Group assignments by piece (all assignments now have piece_id)
  type AssignmentGroup = { key: string; label: string; subtitle: string | null; kind: PieceKind; assignments: AssignmentWithPiece[] };
  const groups = new Map<string, AssignmentGroup>();
  for (const assignment of allAssignments) {
    const group = groups.get(assignment.piece_id);
    if (group) {
      group.assignments.push(assignment);
    } else {
      groups.set(assignment.piece_id, {
        key: assignment.piece_id,
        label: assignment.piece_name,
        subtitle: assignment.piece_composer,
        kind: assignment.kind,
        assignments: [assignment],
      });
    }
  }

  // Sort: system pieces (technique, sight_reading) first, then regular pieces by activePieces order
  const kindOrder: Record<string, number> = { technique: 0, sight_reading: 1, piece: 2 };
  const pieceOrder = new Map(activePieces.map((p, i) => [p.id, i]));
  const sortedGroups = [...groups.values()].sort((a, b) => {
    const kindDiff = (kindOrder[a.kind] ?? 2) - (kindOrder[b.kind] ?? 2);
    if (kindDiff !== 0) return kindDiff;
    return (pieceOrder.get(a.key) ?? Infinity) - (pieceOrder.get(b.key) ?? Infinity);
  });

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
            {sortedGroups.map((group) => (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => onFocusItem(group.key)}
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
                      onToggle={() => handleToggle(assignment.id)}
                      onDelete={() => handleDelete(assignment.id)}
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
