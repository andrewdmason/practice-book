"use client";

import { useState, useCallback, useEffect, useId, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRightIcon,
  ArrowUpFromLineIcon,
  ClockIcon,
  GripVerticalIcon,
  PlusIcon,
} from "lucide-react";
import { useTaskTimer } from "@/components/timer/task-timer-context";
import { TaskRow } from "@/components/practice-table/task-row";
import { PieceSessionsDialog } from "@/components/practice-table/piece-sessions-dialog";
import {
  reorderTasks,
  rollOverUnfinishedTasks,
  updateTasksSession,
} from "@/app/(app)/timer/task-actions";
import { getFeedPage } from "@/app/(app)/feed/actions";
import {
  createTaskOptimistic,
  emitOptimisticTaskUpdate,
  type OptimisticTaskDetail,
  type OptimisticTaskRollback,
  type OptimisticTaskUpdate,
  type OptimisticTaskDelete,
} from "@/lib/optimistic-task";
import { localDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FeedDay, TaskWithDetails, PieceKind, Piece } from "@/lib/types";

type PieceGroup = {
  pieceId: string | null;
  pieceName: string;
  pieceKind: PieceKind | null;
  tasks: TaskWithDetails[];
};

type SessionGroup = {
  sessionNumber: number;
  pieces: PieceGroup[];
};

function formatMinsShort(totalSeconds: number): string {
  const minutes = Math.round(Math.max(0, totalSeconds) / 60);
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function AggregateTimerPill({
  elapsedSeconds,
  goalSeconds,
  onClick,
  title,
  size = "sm",
}: {
  elapsedSeconds: number;
  goalSeconds: number;
  onClick?: () => void;
  title?: string;
  size?: "sm" | "md";
}) {
  const goalReached = goalSeconds > 0 && elapsedSeconds >= goalSeconds;
  const interactive = !!onClick;
  const textClass = size === "md" ? "text-sm" : "text-xs";

  const content = (
    <>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground/70 transition-colors",
          interactive &&
            "group-hover/pill:bg-muted group-hover/pill:text-foreground"
        )}
      >
        <ClockIcon className="size-3" />
        {formatMinsShort(elapsedSeconds)}
      </span>
      <span className="mx-0.5 select-none text-muted-foreground/30">/</span>
      <span
        className={cn(
          "rounded px-1.5 py-0.5 transition-colors",
          goalReached
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            : cn(
                "text-muted-foreground/70",
                interactive &&
                  "group-hover/pill:bg-muted group-hover/pill:text-foreground"
              )
        )}
      >
        {goalSeconds > 0 ? formatMinsShort(goalSeconds) : "—"}
      </span>
    </>
  );

  const baseClass = cn(
    "inline-flex items-center tabular-nums",
    textClass
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={cn("group/pill", baseClass)}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}

function groupTasksByPiece(tasks: TaskWithDetails[]): PieceGroup[] {
  const groups = new Map<string, PieceGroup>();

  for (const task of tasks) {
    const key = task.piece_id ?? "__general__";
    if (!groups.has(key)) {
      groups.set(key, {
        pieceId: task.piece_id,
        pieceName: task.piece_name ?? "General",
        pieceKind: task.piece_kind,
        tasks: [],
      });
    }
    groups.get(key)!.tasks.push(task);
  }

  return Array.from(groups.values());
}

function groupTasksBySession(tasks: TaskWithDetails[]): SessionGroup[] {
  const bySession = new Map<number, TaskWithDetails[]>();
  for (const task of tasks) {
    const sess = task.session_number ?? 1;
    if (!bySession.has(sess)) bySession.set(sess, []);
    bySession.get(sess)!.push(task);
  }
  return Array.from(bySession.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([sessionNumber, sessionTasks]) => ({
      sessionNumber,
      pieces: groupTasksByPiece(sessionTasks),
    }));
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const todayStr = localDate(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDate(yesterday);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localDate(tomorrow);

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";
  if (dateStr === tomorrowStr) return "Tomorrow";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function SortablePieceGroup({
  group,
  onAddTask,
  daySessionNumbers,
  currentSessionNumber,
}: {
  group: PieceGroup;
  onAddTask: (afterTaskId: string | null) => void;
  daySessionNumbers: number[];
  currentSessionNumber: number;
}) {
  const sortableId = `piece:${group.pieceId ?? "__general__"}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const gripButtonRef = useRef<HTMLButtonElement>(null);
  const gripPointerStart = useRef<{ x: number; y: number } | null>(null);

  const handleGripPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    gripPointerStart.current = { x: e.clientX, y: e.clientY };
    listeners?.onPointerDown?.(e);
  };

  const handleGripPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const start = gripPointerStart.current;
    gripPointerStart.current = null;
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 5;
    if (!moved) setMenuOpen((prev) => !prev);
  };

  const moveAllTasksToSession = (n: number) => {
    const taskIds = group.tasks.map((t) => t.id);
    for (const id of taskIds) {
      emitOptimisticTaskUpdate(id, { session_number: n });
    }
    void updateTasksSession(taskIds, n);
  };

  const totalElapsed = group.tasks.reduce(
    (sum, t) => sum + Math.max(0, t.timer_seconds - t.timer_remaining_seconds),
    0
  );
  const totalGoal = group.tasks.reduce(
    (sum, t) => sum + Math.max(0, t.timer_seconds),
    0
  );
  const showPieceTimer = totalElapsed > 0 || totalGoal > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("group/piece mb-3", isDragging && "opacity-50")}
    >
      {/* Piece header with drag handle in gutter */}
      <div className="flex items-stretch mb-1.5">
        <div
          className={cn(
            "-ml-8 w-8 shrink-0 flex items-center justify-center gap-0 transition-opacity",
            menuOpen ? "opacity-100" : "opacity-0 group-hover/piece:opacity-100"
          )}
        >
          <button
            type="button"
            onClick={() => onAddTask(null)}
            className="flex items-center justify-center w-4 h-6 rounded-sm text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
            title="Add task"
          >
            <PlusIcon className="size-3.5" />
          </button>
          <button
            ref={gripButtonRef}
            type="button"
            {...attributes}
            onPointerDown={handleGripPointerDown}
            onPointerUp={handleGripPointerUp}
            className="flex items-center justify-center w-4 h-6 cursor-grab rounded-sm text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
          >
            <GripVerticalIcon className="size-3.5" />
          </button>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuContent
              anchor={gripButtonRef}
              align="start"
              side="bottom"
              className="w-48"
            >
              {daySessionNumbers
                .filter((n) => n !== currentSessionNumber)
                .map((n) => (
                  <DropdownMenuItem
                    key={n}
                    onClick={() => moveAllTasksToSession(n)}
                  >
                    <ArrowRightIcon />
                    Move to session {n}
                  </DropdownMenuItem>
                ))}
              <DropdownMenuItem
                onClick={() => {
                  const next =
                    (daySessionNumbers.length > 0
                      ? Math.max(...daySessionNumbers)
                      : currentSessionNumber) + 1;
                  moveAllTasksToSession(next);
                }}
              >
                <PlusIcon />
                Move to new session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1.5 px-1">
          <h3 className="text-sm font-medium text-foreground">
            {group.pieceName}
          </h3>
          {showPieceTimer && (
            <AggregateTimerPill
              elapsedSeconds={totalElapsed}
              goalSeconds={totalGoal}
              onClick={
                group.pieceId && totalElapsed > 0
                  ? () => setSessionsOpen(true)
                  : undefined
              }
              title={
                group.pieceId && totalElapsed > 0
                  ? "Edit individual sessions"
                  : undefined
              }
            />
          )}
        </div>
      </div>

      {/* Task rows */}
      <SortableContext
        items={group.tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {group.tasks.map((task, index) => (
          <TaskRow
            key={task.id}
            task={task}
            isFirst={index === 0}
            onAddBelow={(afterTaskId) => onAddTask(afterTaskId)}
            daySessionNumbers={daySessionNumbers}
          />
        ))}
      </SortableContext>
      {group.pieceId && (
        <PieceSessionsDialog
          open={sessionsOpen}
          onOpenChange={setSessionsOpen}
          title={group.pieceName}
          tasks={group.tasks}
        />
      )}
    </div>
  );
}

function SessionBlock({
  sessionNumber,
  pieces,
  showHeader,
  isFirst,
  dayDate,
  daySessionNumbers,
  focusedPieceId,
  activePieces,
  onReorder,
  onAddTask,
  onAddPiece,
}: {
  sessionNumber: number;
  pieces: PieceGroup[];
  showHeader: boolean;
  isFirst: boolean;
  dayDate: string;
  daySessionNumbers: number[];
  focusedPieceId: string | null;
  activePieces: Piece[];
  onReorder: (dayDate: string, orderedIds: string[]) => void;
  onAddTask: (
    pieceId: string | null,
    sessionNumber: number,
    afterTaskId?: string | null
  ) => void;
  onAddPiece: (piece: Piece, sessionNumber: number) => void;
}) {
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      if (activeId.startsWith("piece:")) {
        const pieceKey = (g: PieceGroup) =>
          `piece:${g.pieceId ?? "__general__"}`;
        const oldIndex = pieces.findIndex((g) => pieceKey(g) === activeId);
        const newIndex = overId.startsWith("piece:")
          ? pieces.findIndex((g) => pieceKey(g) === overId)
          : pieces.findIndex((g) => g.tasks.some((t) => t.id === overId));
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        const reordered = [...pieces];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        const reorderedTaskIds = reordered.flatMap((g) =>
          g.tasks.map((t) => t.id)
        );
        if (reorderedTaskIds.length === 0) return;
        onReorder(dayDate, reorderedTaskIds);
        void reorderTasks(reorderedTaskIds);
        return;
      }

      for (const group of pieces) {
        const taskIds = group.tasks.map((t) => t.id);
        const oldIndex = taskIds.indexOf(activeId);
        const newIndex = taskIds.indexOf(overId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = [...taskIds];
          reordered.splice(oldIndex, 1);
          reordered.splice(newIndex, 0, activeId);
          onReorder(dayDate, reordered);
          void reorderTasks(reordered);
          break;
        }
      }
    },
    [pieces, dayDate, onReorder]
  );

  const sessionElapsed = pieces
    .flatMap((p) => p.tasks)
    .reduce(
      (sum, t) => sum + Math.max(0, t.timer_seconds - t.timer_remaining_seconds),
      0
    );
  const sessionGoal = pieces
    .flatMap((p) => p.tasks)
    .reduce((sum, t) => sum + Math.max(0, t.timer_seconds), 0);
  const showSessionTimer = sessionElapsed > 0 || sessionGoal > 0;

  const existingPieceIds = new Set(
    pieces.map((g) => g.pieceId).filter((id): id is string => id !== null)
  );
  const addablePieces = activePieces.filter(
    (p) => !existingPieceIds.has(p.id)
  );

  return (
    <div className={cn("mb-5", !isFirst && showHeader && "mt-6")}>
      {showHeader && (
        <div className="group/session flex items-center gap-3 mb-3 px-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
            Session {sessionNumber}
          </span>
          <div className="h-px flex-1 bg-border/60" />
          {showSessionTimer && (
            <AggregateTimerPill
              elapsedSeconds={sessionElapsed}
              goalSeconds={sessionGoal}
              size="sm"
            />
          )}
          {!focusedPieceId && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground size-5 opacity-0 group-hover/session:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                title="Add to session"
              >
                <PlusIcon className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => onAddTask(null, sessionNumber)}
                >
                  <span className="text-sm">General note</span>
                </DropdownMenuItem>
                {addablePieces.length > 0 && <DropdownMenuSeparator />}
                {addablePieces.map((piece) => (
                  <DropdownMenuItem
                    key={piece.id}
                    onClick={() => onAddPiece(piece, sessionNumber)}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">{piece.name}</span>
                      {piece.composer && (
                        <span className="text-xs text-muted-foreground">
                          {piece.composer}
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={pieces.map((g) => `piece:${g.pieceId ?? "__general__"}`)}
          strategy={verticalListSortingStrategy}
        >
          {pieces.map((group) => (
            <SortablePieceGroup
              key={group.pieceId ?? "__general__"}
              group={group}
              onAddTask={(afterTaskId) =>
                onAddTask(group.pieceId, sessionNumber, afterTaskId)
              }
              daySessionNumbers={daySessionNumbers}
              currentSessionNumber={sessionNumber}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function DayGroup({
  day,
  focusedPieceId,
  focusedPieceName,
  activePieces,
  hasTomorrow,
  hasUnfinishedBefore,
  onReorder,
}: {
  day: FeedDay;
  focusedPieceId: string | null;
  focusedPieceName: string | null;
  activePieces: Piece[];
  hasTomorrow: boolean;
  hasUnfinishedBefore: boolean;
  onReorder: (dayDate: string, orderedIds: string[]) => void;
}) {
  const filteredTasks = focusedPieceId
    ? day.tasks.filter((t) => t.piece_id === focusedPieceId)
    : day.tasks;

  const sessionGroups = groupTasksBySession(filteredTasks);
  const [pendingNewSession, setPendingNewSession] = useState<number | null>(
    null
  );

  const maxExistingSession = sessionGroups.reduce(
    (m, s) => Math.max(m, s.sessionNumber),
    0
  );

  // Treat a pending session as active only while no real session with that
  // number exists. Once a task is added, the real session takes over and the
  // pending slot disappears naturally without needing to reset state.
  const pendingEmptySession =
    pendingNewSession !== null &&
    !sessionGroups.some((s) => s.sessionNumber === pendingNewSession)
      ? pendingNewSession
      : null;

  const defaultAddSession =
    pendingEmptySession ?? (maxExistingSession > 0 ? maxExistingSession : 1);

  const sessionsToRender: SessionGroup[] = [
    ...sessionGroups,
    ...(pendingEmptySession !== null
      ? [{ sessionNumber: pendingEmptySession, pieces: [] }]
      : []),
  ];
  const showSessionHeaders = sessionsToRender.length > 1;

  const handleAddTask = async (
    pieceId: string | null,
    sessionNumber: number,
    afterTaskId: string | null = null
  ) => {
    const session = sessionGroups.find(
      (s) => s.sessionNumber === sessionNumber
    );
    const group = session?.pieces.find((g) => g.pieceId === pieceId);
    await createTaskOptimistic({
      pieceId,
      sectionId: null,
      date: day.date,
      metronomeSpeed: null,
      pieceName:
        group?.pieceName ??
        (pieceId === focusedPieceId ? focusedPieceName : null),
      pieceComposer: group?.tasks[0]?.piece_composer ?? null,
      pieceKind: group?.pieceKind ?? null,
      sectionLabel: null,
      sectionStatus: null,
      afterTaskId,
      sessionNumber,
    });
  };

  const handleAddPiece = async (piece: Piece, sessionNumber: number) => {
    await createTaskOptimistic({
      pieceId: piece.id,
      sectionId: null,
      date: day.date,
      metronomeSpeed: null,
      pieceName: piece.name,
      pieceComposer: piece.composer,
      pieceKind: piece.kind,
      sectionLabel: null,
      sectionStatus: null,
      sessionNumber,
    });
  };

  const handleAddSession = () => {
    const base = Math.max(maxExistingSession, pendingEmptySession ?? 0);
    setPendingNewSession(base + 1);
  };

  const dayExistingPieceIds = new Set(
    filteredTasks
      .map((t) => t.piece_id)
      .filter((id): id is string => id !== null)
  );
  const dayAddablePieces = activePieces.filter(
    (p) => !dayExistingPieceIds.has(p.id)
  );

  const dayElapsedSeconds = day.tasks.reduce(
    (sum, t) => sum + Math.max(0, t.timer_seconds - t.timer_remaining_seconds),
    0
  );
  const dayGoalSeconds = day.tasks.reduce(
    (sum, t) => sum + Math.max(0, t.timer_seconds),
    0
  );
  const showDayTimer = dayElapsedSeconds > 0 || dayGoalSeconds > 0;
  const todayStr = localDate();
  const isToday = day.date === todayStr;

  if (
    sessionGroups.length === 0 &&
    pendingEmptySession === null &&
    !isToday
  )
    return null;

  return (
    <div className="group/day mb-8">
      {isToday && hasTomorrow && <hr className="mb-8 border-border" />}
      {/* Day header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2
          className={cn(
            "text-lg font-semibold",
            isToday ? "text-sky-600 dark:text-sky-400" : "text-foreground"
          )}
        >
          {formatDate(day.date)}
        </h2>
        {showDayTimer && (
          <AggregateTimerPill
            elapsedSeconds={dayElapsedSeconds}
            goalSeconds={dayGoalSeconds}
            size="md"
          />
        )}
        {!focusedPieceId && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground size-6 opacity-0 group-hover/day:opacity-100 data-[state=open]:opacity-100 transition-opacity"
              title="Add task"
            >
              <PlusIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => handleAddTask(null, defaultAddSession)}
              >
                <span className="text-sm">General note</span>
              </DropdownMenuItem>
              {dayAddablePieces.length > 0 && <DropdownMenuSeparator />}
              {dayAddablePieces.map((piece) => (
                <DropdownMenuItem
                  key={piece.id}
                  onClick={() => handleAddPiece(piece, defaultAddSession)}
                >
                  <div className="flex flex-col">
                    <span className="text-sm">{piece.name}</span>
                    {piece.composer && (
                      <span className="text-xs text-muted-foreground">
                        {piece.composer}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              {filteredTasks.length > 0 && pendingEmptySession === null && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleAddSession}>
                    <PlusIcon />
                    <span className="text-sm">New session</span>
                  </DropdownMenuItem>
                </>
              )}
              {isToday && hasUnfinishedBefore && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      void rollOverUnfinishedTasks();
                    }}
                  >
                    <ArrowUpFromLineIcon />
                    <span className="text-sm">Roll over unfinished</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Session blocks */}
      {sessionsToRender.map((session, index) => (
        <SessionBlock
          key={session.sessionNumber}
          sessionNumber={session.sessionNumber}
          pieces={session.pieces}
          showHeader={showSessionHeaders}
          isFirst={index === 0}
          dayDate={day.date}
          daySessionNumbers={sessionsToRender.map((s) => s.sessionNumber)}
          focusedPieceId={focusedPieceId}
          activePieces={activePieces}
          onReorder={onReorder}
          onAddTask={handleAddTask}
          onAddPiece={handleAddPiece}
        />
      ))}

      {/* Empty state for today when the current view has no tasks */}
      {isToday &&
        sessionGroups.length === 0 &&
        pendingEmptySession === null && (
          <div className="mb-3">
            {focusedPieceId && focusedPieceName && (
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {focusedPieceName}
                </h3>
              </div>
            )}
            <button
              onClick={() => handleAddTask(focusedPieceId, 1)}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <PlusIcon className="size-3" />
              No practice yet today. Hit record or add a task.
            </button>
          </div>
        )}

      {isToday && <hr className="mt-8 border-border" />}
    </div>
  );
}

export function PracticeTable({
  initialData,
}: {
  initialData: { items: FeedDay[]; nextCursor: string | null };
}) {
  const { focusedPieceId, activePieces } = useTaskTimer();
  const focusedPieceName =
    activePieces.find((p) => p.id === focusedPieceId)?.name ?? null;
  const [days, setDays] = useState<FeedDay[]>(initialData.items);
  const [cursor, setCursor] = useState<string | null>(initialData.nextCursor);
  const [loading, setLoading] = useState(false);

  // Update when initialData changes (e.g., from server revalidation)
  useEffect(() => {
    setDays(initialData.items);
    setCursor(initialData.nextCursor);
  }, [initialData]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const result = await getFeedPage(cursor, 7);
      setDays((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  const handleReorder = useCallback(
    (dayDate: string, orderedIds: string[]) => {
      const idSet = new Set(orderedIds);
      setDays((prev) =>
        prev.map((d) => {
          if (d.date !== dayDate) return d;
          const taskMap = new Map(d.tasks.map((t) => [t.id, t]));
          let i = 0;
          const newTasks = d.tasks.map((t) => {
            if (idSet.has(t.id)) {
              return taskMap.get(orderedIds[i++])!;
            }
            return t;
          });
          return { ...d, tasks: newTasks };
        })
      );
    },
    []
  );

  // Optimistic task-created listener
  useEffect(() => {
    const addHandler = (e: Event) => {
      const detail = (e as CustomEvent<OptimisticTaskDetail>).detail;
      const optimistic: TaskWithDetails = {
        id: detail.tempId,
        piece_id: detail.pieceId,
        section_id: detail.sectionId,
        date: detail.date,
        text: detail.text ?? "",
        metronome_speed: detail.metronomeSpeed,
        timer_seconds: detail.timerSeconds ?? 0,
        timer_remaining_seconds: detail.timerSeconds ?? 0,
        completed: false,
        completed_at: null,
        started_at: null,
        ended_at: null,
        sort_order: Number.MAX_SAFE_INTEGER,
        session_number: detail.sessionNumber ?? 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        piece_name: detail.pieceName,
        piece_composer: detail.pieceComposer,
        piece_kind: detail.pieceKind,
        section_label: detail.sectionLabel,
        section_status: detail.sectionStatus,
      };
      setDays((prev) => {
        const idx = prev.findIndex((d) => d.date === detail.date);
        if (idx >= 0) {
          const next = [...prev];
          const tasks = [...next[idx].tasks];
          const anchorIdx = detail.afterTaskId
            ? tasks.findIndex((t) => t.id === detail.afterTaskId)
            : -1;
          if (anchorIdx >= 0) {
            tasks.splice(anchorIdx + 1, 0, optimistic);
          } else {
            tasks.push(optimistic);
          }
          next[idx] = { ...next[idx], tasks };
          return next;
        }
        const newDay: FeedDay = {
          date: detail.date,
          tasks: [optimistic],
          timeSummary: [],
        };
        return [newDay, ...prev].sort((a, b) => b.date.localeCompare(a.date));
      });
    };

    const rollbackHandler = (e: Event) => {
      const { tempId } = (e as CustomEvent<OptimisticTaskRollback>).detail;
      setDays((prev) =>
        prev.map((d) => ({
          ...d,
          tasks: d.tasks.filter((t) => t.id !== tempId),
        }))
      );
    };

    const updateHandler = (e: Event) => {
      const { taskId, updates } = (e as CustomEvent<OptimisticTaskUpdate>).detail;
      setDays((prev) =>
        prev.map((d) => {
          if (!d.tasks.some((t) => t.id === taskId)) return d;
          return {
            ...d,
            tasks: d.tasks.map((t) =>
              t.id === taskId ? { ...t, ...updates } : t
            ),
          };
        })
      );
    };

    const deleteHandler = (e: Event) => {
      const { taskId } = (e as CustomEvent<OptimisticTaskDelete>).detail;
      setDays((prev) =>
        prev.map((d) => ({
          ...d,
          tasks: d.tasks.filter((t) => t.id !== taskId),
        }))
      );
    };

    window.addEventListener("task-created-optimistic", addHandler);
    window.addEventListener("task-created-rollback", rollbackHandler);
    window.addEventListener("task-updated-optimistic", updateHandler);
    window.addEventListener("task-deleted-optimistic", deleteHandler);
    return () => {
      window.removeEventListener("task-created-optimistic", addHandler);
      window.removeEventListener("task-created-rollback", rollbackHandler);
      window.removeEventListener("task-updated-optimistic", updateHandler);
      window.removeEventListener("task-deleted-optimistic", deleteHandler);
    };
  }, []);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!cursor) return;
    const sentinel = document.getElementById("load-more-sentinel");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return localDate(d);
  })();
  const hasTomorrow = days.some((d) => d.date === tomorrowStr);
  const hasUnfinishedBefore = days.some(
    (d) => d.date < localDate() && d.tasks.some((t) => !t.completed)
  );

  // Always include today in the displayed list so we can render an empty state
  // even when nothing has been logged yet.
  const todayStr = localDate();
  const displayDays = days.some((d) => d.date === todayStr)
    ? days
    : [
        ...days.filter((d) => d.date > todayStr),
        { date: todayStr, tasks: [], timeSummary: [] } as FeedDay,
        ...days.filter((d) => d.date < todayStr),
      ];

  return (
    <div className="pl-8">
      {displayDays.map((day) => (
        <DayGroup
          key={day.date}
          day={day}
          focusedPieceId={focusedPieceId}
          focusedPieceName={focusedPieceName}
          activePieces={activePieces}
          hasTomorrow={hasTomorrow}
          hasUnfinishedBefore={hasUnfinishedBefore}
          onReorder={handleReorder}
        />
      ))}

      {cursor && (
        <div id="load-more-sentinel" className="py-4 text-center">
          {loading && (
            <span className="text-sm text-muted-foreground">Loading...</span>
          )}
        </div>
      )}

    </div>
  );
}
