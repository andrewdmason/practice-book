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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { useTimer } from "@/components/timer/timer-context";
import { TimeSummary } from "@/components/timer/time-summary";
import { getTodaySummary } from "@/app/(app)/timer/actions";
import {
  getCategoryFocusData,
  getAllOpenTasks,
  getPieceFocusData,
  updateTaskProgress,
  updateTaskNote,
} from "@/app/(app)/focus-panel/actions";
import type { TaskWithPiece } from "@/app/(app)/focus-panel/actions";
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
  Task,
  TimerTarget,
  TimeSummaryEntry,
} from "@/lib/types";

// Client-side caches so re-selecting a piece shows data instantly
const sectionsCache = new Map<string, PieceSectionWithChildren[]>();
const tasksCache = new Map<string, { openTasks: Task[]; completedTasks: Task[] }>();

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

  if (activePieceId) {
    const activePiece = activePieces.find((p) => p.id === activePieceId);
    return <PieceDetail pieceId={activePieceId} knownPiece={activePiece ?? null} />;
  }

  const activeCategory = activeTarget?.category !== "piece" ? activeTarget?.category : null;

  if (activeCategory === "technique" || activeCategory === "sight_reading") {
    return <CategoryDetail category={activeCategory} />;
  }

  return (
    <PracticeOverview
      isRunning={isRunning}
      onFocusItem={handleFocusItem}
      activePieces={activePieces}
    />
  );
}

// ---------------------------------------------------------------------------
// Piece Detail
// ---------------------------------------------------------------------------

function PieceDetail({ pieceId, knownPiece }: { pieceId: string; knownPiece: Piece | null }) {
  const cached = tasksCache.get(pieceId);
  const [piece, setPiece] = useState<{
    name: string;
    composer: string | null;
    target_tempo: number | null;
  } | null>(knownPiece ? { name: knownPiece.name, composer: knownPiece.composer, target_tempo: knownPiece.target_tempo } : null);
  const [openTasks, setOpenTasks] = useState<Task[]>(cached?.openTasks ?? []);
  const [completedTasks, setCompletedTasks] = useState<Task[]>(cached?.completedTasks ?? []);
  const [sections, setSections] = useState<PieceSectionWithChildren[]>(
    () => sectionsCache.get(pieceId) ?? []
  );
  const [showCompleted, setShowCompleted] = useState(false);
  const [loaded, setLoaded] = useState(!!cached);

  // Update piece immediately when knownPiece changes (no network needed)
  useEffect(() => {
    if (knownPiece) {
      setPiece({ name: knownPiece.name, composer: knownPiece.composer, target_tempo: knownPiece.target_tempo });
    }
  }, [knownPiece]);

  const refreshTasks = useCallback(() => {
    getPieceFocusData(pieceId).then((data) => {
      tasksCache.set(pieceId, data);
      setOpenTasks(data.openTasks);
      setCompletedTasks(data.completedTasks);
      setLoaded(true);
    });
  }, [pieceId]);

  const refreshSections = useCallback(() => {
    getSections(pieceId).then((data) => {
      sectionsCache.set(pieceId, data);
      setSections(data);
    }).catch(() => {
      // Retry once on failure
      getSections(pieceId).then((data) => {
        sectionsCache.set(pieceId, data);
        setSections(data);
      }).catch(() => {});
    });
  }, [pieceId]);

  useEffect(() => {
    // Load from cache immediately when pieceId changes
    const cachedSections = sectionsCache.get(pieceId);
    if (cachedSections) setSections(cachedSections);
    const cachedTasks = tasksCache.get(pieceId);
    if (cachedTasks) {
      setOpenTasks(cachedTasks.openTasks);
      setCompletedTasks(cachedTasks.completedTasks);
      setLoaded(true);
    } else {
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

    refreshTasks();
    refreshSections();
  }, [pieceId, refreshTasks, refreshSections, knownPiece]);

  useEffect(() => {
    const handler = () => refreshTasks();
    window.addEventListener("tasks-changed", handler);
    return () => window.removeEventListener("tasks-changed", handler);
  }, [refreshTasks]);

  useEffect(() => {
    const handler = () => refreshSections();
    window.addEventListener("sections-changed", handler);
    return () => window.removeEventListener("sections-changed", handler);
  }, [refreshSections]);

  // Optimistically apply status changes from other components (e.g. scrubber bar)
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

  const handleProgressChange = (taskId: string, progress: number) => {
    if (progress === 4) {
      // Move from open to completed
      const task = openTasks.find((t) => t.id === taskId);
      if (task) {
        const updated = { ...task, progress, completed_at: new Date().toISOString() };
        setOpenTasks((prev) => prev.filter((t) => t.id !== taskId));
        setCompletedTasks((prev) => [updated, ...prev]);
      }
    } else {
      // Could be un-completing from completed list or updating open task progress
      const completedTask = completedTasks.find((t) => t.id === taskId);
      if (completedTask) {
        const updated = { ...completedTask, progress, completed_at: null };
        setCompletedTasks((prev) => prev.filter((t) => t.id !== taskId));
        setOpenTasks((prev) => [updated, ...prev]);
      } else {
        setOpenTasks((prev) =>
          prev.map((t) => t.id === taskId ? { ...t, progress } : t)
        );
      }
    }
  };

  const handleNoteChange = (taskId: string, note: string | null) => {
    setOpenTasks((prev) =>
      prev.map((t) => t.id === taskId ? { ...t, note } : t)
    );
    setCompletedTasks((prev) =>
      prev.map((t) => t.id === taskId ? { ...t, note } : t)
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-base">
            <Link
              href={`/repertoire/${pieceId}`}
              className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              {piece.name}
              <ExternalLinkIcon className="size-3 text-muted-foreground" />
            </Link>
          </CardTitle>
          {piece.composer && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {piece.composer}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Open Tasks */}
        {loaded && openTasks.length > 0 && (
          <FocusSection
            icon={<CheckCircle2Icon className="size-3.5" />}
            title="Tasks"
            count={openTasks.length}
          >
            {openTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onProgressChange={(progress) => handleProgressChange(task.id, progress)}
                onNoteChange={(note) => handleNoteChange(task.id, note)}
              />
            ))}
          </FocusSection>
        )}

        {/* Completed Tasks (collapsible) */}
        {loaded && completedTasks.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
            >
              <ChevronDownIcon className={`size-3.5 transition-transform ${showCompleted ? "" : "-rotate-90"}`} />
              Completed
              <span className="text-[10px] font-normal bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                {completedTasks.length}
              </span>
            </button>
            {showCompleted && (
              <div className="space-y-1.5">
                {completedTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onProgressChange={(progress) => handleProgressChange(task.id, progress)}
                    onNoteChange={(note) => handleNoteChange(task.id, note)}
                    showCompletedDate
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {loaded && openTasks.length === 0 && completedTasks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No tasks yet.
          </p>
        )}

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
          />
        )}

        {/* YouTube video */}
        <PieceVideo />

      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Piece Video (YouTube embed in sidebar)
// ---------------------------------------------------------------------------

function PieceVideo() {
  const { videoId } = useVideo();
  if (!videoId) return null;
  return <YouTubePlayer />;
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

function TaskTextWithMetronome({ text }: { text: string }) {
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

function TaskRow({
  task,
  onProgressChange,
  onNoteChange,
  showCompletedDate,
}: {
  task: Task;
  onProgressChange: (progress: number) => void;
  onNoteChange: (note: string | null) => void;
  showCompletedDate?: boolean;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(task.note ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    let newProgress: number;
    if (e.altKey) {
      newProgress = (task.progress + 1) % 5;
    } else {
      newProgress = task.progress === 4 ? 0 : 4;
    }
    onProgressChange(newProgress);
    updateTaskProgress(task.id, newProgress);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const newProgress = getNextBounceProgress(task.id, task.progress);
    onProgressChange(newProgress);
    updateTaskProgress(task.id, newProgress);
  };

  const handleNoteSave = () => {
    setEditingNote(false);
    const trimmed = noteValue.trim() || null;
    if (trimmed !== task.note) {
      onNoteChange(trimmed);
      // Notify editor TaskItemViews of the note change
      window.dispatchEvent(
        new CustomEvent("task-note-updated", {
          detail: { taskId: task.id, note: trimmed },
        })
      );
      updateTaskNote(task.id, trimmed);
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
          <ProgressCircle progress={task.progress} size={16} />
        </button>
        <span className={`flex-1 ${task.progress === 4 ? "line-through text-muted-foreground" : ""}`}>
          <TaskTextWithMetronome text={task.text} />
        </span>
        <button
          type="button"
          onClick={() => {
            const el = document.querySelector(`[data-task-id="${task.id}"]`);
            if (el) {
              document.querySelectorAll(".task-highlight").forEach((prev) => prev.classList.remove("task-highlight"));
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              void (el as HTMLElement).offsetWidth;
              el.classList.add("task-highlight");
              el.addEventListener("animationend", () => el.classList.remove("task-highlight"), { once: true });
            }
          }}
          className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
          title="Jump to task in feed"
        >
          <ArrowRightIcon className="size-3" />
        </button>
        {!editingNote && !task.note && (
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
      {task.note && !editingNote && (
        <p
          className="ml-6 mt-0.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={() => {
            setNoteValue(task.note ?? "");
            setEditingNote(true);
          }}
        >
          {task.note}
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
              setNoteValue(task.note ?? "");
            }
          }}
          className="ml-6 mt-1 w-[calc(100%-1.5rem)] rounded border bg-background px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          rows={2}
          placeholder="Add a note..."
        />
      )}
      {/* Completed date */}
      {showCompletedDate && task.completed_at && (
        <p className="ml-6 mt-0.5 text-[10px] text-muted-foreground/70">
          Completed {formatDate(task.completed_at.slice(0, 10))}
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  const label = TIMER_CATEGORY_LABELS[category] ?? category;

  const refreshTasks = useCallback(() => {
    getCategoryFocusData(category).then((data) => {
      setTasks(data.tasks);
      setLoaded(true);
    });
  }, [category]);

  useEffect(() => {
    setLoaded(false);
    refreshTasks();
  }, [refreshTasks]);

  useEffect(() => {
    const handler = () => refreshTasks();
    window.addEventListener("tasks-changed", handler);
    return () => window.removeEventListener("tasks-changed", handler);
  }, [refreshTasks]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MusicIcon className="size-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loaded && tasks.length > 0 && (
          <FocusSection
            icon={<CheckCircle2Icon className="size-3.5" />}
            title="Tasks"
            count={tasks.filter((t) => t.progress < 4).length}
          >
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} onProgressChange={(progress) => {
                setTasks((prev) =>
                  prev.map((t) => t.id === task.id ? { ...t, progress } : t)
                );
              }} onNoteChange={(note) => {
                setTasks((prev) =>
                  prev.map((t) => t.id === task.id ? { ...t, note } : t)
                );
              }} />
            ))}
          </FocusSection>
        )}
        {loaded && tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No tasks yet.
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
  const [allTasks, setAllTasks] = useState<TaskWithPiece[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refreshData = useCallback(() => {
    Promise.all([getTodaySummary(), getAllOpenTasks()]).then(
      ([summaryData, tasksData]) => {
        setSummary(summaryData);
        setAllTasks(tasksData);
        setLoaded(true);
      }
    );
  }, []);

  useEffect(() => {
    refreshData();
  }, [isRunning, refreshData]);

  useEffect(() => {
    const handler = () => refreshData();
    window.addEventListener("tasks-changed", handler);
    return () => window.removeEventListener("tasks-changed", handler);
  }, [refreshData]);

  const handleProgressChange = (taskId: string, progress: number) => {
    if (progress === 4) {
      setAllTasks((prev) => prev.filter((t) => t.id !== taskId));
    } else {
      setAllTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, progress } : t))
      );
    }
  };

  const handleNoteChange = (taskId: string, note: string | null) => {
    setAllTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, note } : t))
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

  // Group tasks by piece or category
  type TaskGroup = { key: string; label: string; subtitle: string | null; focusKey: string; tasks: TaskWithPiece[] };
  const pieceGroups = new Map<string, TaskGroup>();
  const categoryGroups = new Map<string, TaskGroup>();
  for (const task of allTasks) {
    if (task.piece_id && task.piece_name) {
      const group = pieceGroups.get(task.piece_id);
      if (group) {
        group.tasks.push(task);
      } else {
        pieceGroups.set(task.piece_id, {
          key: task.piece_id,
          label: task.piece_name,
          subtitle: task.piece_composer,
          focusKey: task.piece_id,
          tasks: [task],
        });
      }
    } else {
      const cat = task.section_category ?? "other";
      const group = categoryGroups.get(cat);
      if (group) {
        group.tasks.push(task);
      } else {
        const label = TIMER_CATEGORY_LABELS[cat as keyof typeof TIMER_CATEGORY_LABELS] ?? cat;
        categoryGroups.set(cat, {
          key: cat,
          label,
          subtitle: null,
          focusKey: cat,
          tasks: [task],
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
      {allTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2Icon className="size-4" />
              Active Tasks
              <span className="text-xs font-normal bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                {allTasks.length}
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
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onProgressChange={(progress) => handleProgressChange(task.id, progress)}
                      onNoteChange={(note) => handleNoteChange(task.id, note)}
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
