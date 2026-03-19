"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  MessageSquareTextIcon,
  MusicIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { MasteryBadge } from "@/components/repertoire/mastery-badge";
import { useTimer } from "@/components/timer/timer-context";
import { TimeSummary } from "@/components/timer/time-summary";
import { getTodaySummary } from "@/app/(app)/timer/actions";
import {
  getPieceFocusData,
  toggleTaskCompleted,
} from "@/app/(app)/focus-panel/actions";
import { createClient } from "@/lib/supabase/client";
import { TIMER_CATEGORY_LABELS } from "@/lib/timer-utils";
import type {
  MasteryLevel,
  MentionWithSource,
  Task,
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
      router.replace(`/?focus=${focusKey}`, { scroll: false });
    },
    [isRunning, activePieces, setFocusedTarget, router]
  );

  if (activePieceId) {
    return <PieceDetail pieceId={activePieceId} />;
  }

  const showCategory = activeTarget?.category != null && activeTarget.category !== "piece";

  return (
    <PracticeOverview
      isRunning={isRunning}
      showCategoryCard={showCategory}
      currentCategory={activeTarget?.category ?? null}
      onFocusItem={handleFocusItem}
    />
  );
}

// ---------------------------------------------------------------------------
// Piece Detail
// ---------------------------------------------------------------------------

function PieceDetail({ pieceId }: { pieceId: string }) {
  const [piece, setPiece] = useState<{
    name: string;
    composer: string | null;
    mastery_level: string;
  } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mentions, setMentions] = useState<MentionWithSource[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const supabase = createClient();

    supabase
      .from("pieces")
      .select("name, composer, mastery_level")
      .eq("id", pieceId)
      .single()
      .then(({ data }) => {
        if (data) {
          setPiece({
            name: data.name,
            composer: data.composer,
            mastery_level: data.mastery_level,
          });
        }
      });

    // Fetch focus data (tasks, mentions)
    getPieceFocusData(pieceId).then((data) => {
      setTasks(data.tasks);
      setMentions(data.mentions);
      setLoaded(true);
    });
  }, [pieceId]);

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
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{piece.name}</CardTitle>
            {piece.composer && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {piece.composer}
              </p>
            )}
          </div>
          <MasteryBadge
            level={piece.mastery_level as MasteryLevel}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tasks */}
        {loaded && tasks.length > 0 && (
          <FocusSection
            icon={<CheckCircle2Icon className="size-3.5" />}
            title="Tasks"
            count={tasks.filter((t) => !t.completed).length}
          >
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={(completed) => {
                setTasks((prev) =>
                  prev.map((t) => t.id === task.id ? { ...t, completed } : t)
                );
              }} />
            ))}
          </FocusSection>
        )}

        {/* Recent Mentions */}
        {loaded && mentions.length > 0 && (
          <FocusSection
            icon={<MessageSquareTextIcon className="size-3.5" />}
            title="Recent Mentions"
          >
            {mentions.map((mention) => (
              <MentionRow key={mention.id} mention={mention} />
            ))}
          </FocusSection>
        )}

        {/* Empty state */}
        {loaded && tasks.length === 0 && mentions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No tasks or mentions yet.
          </p>
        )}

        <Link
          href={`/repertoire/${pieceId}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLinkIcon className="size-3" />
          View full page
        </Link>
      </CardContent>
    </Card>
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

function TaskRow({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (completed: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer group">
      <Checkbox
        className="mt-0.5"
        checked={task.completed}
        disabled={isPending}
        onCheckedChange={(checked) => {
          const completed = !!checked;
          onToggle(completed);
          startTransition(async () => {
            await toggleTaskCompleted(task.id, completed);
            router.refresh();
          });
        }}
      />
      <span className={`flex-1 ${task.completed ? "line-through text-muted-foreground" : ""} ${isPending ? "opacity-50" : ""}`}>
        {task.text}
      </span>
    </label>
  );
}

function MentionRow({ mention }: { mention: MentionWithSource }) {
  const isLesson = mention.source_label === "Lesson";
  const href = isLesson
    ? `/?date=${mention.source_date}`
    : `/`; // navigate to home feed

  return (
    <Link
      href={href}
      className="block text-sm hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 transition-colors"
    >
      {mention.context_snippet && (
        <p className="text-foreground line-clamp-2">
          &ldquo;{mention.context_snippet}&rdquo;
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-0.5">
        {mention.source_label} &middot; {formatDate(mention.source_date)}
      </p>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Practice Overview (sidebar when no piece is focused)
// ---------------------------------------------------------------------------

function PracticeOverview({
  isRunning,
  showCategoryCard,
  currentCategory,
  onFocusItem,
}: {
  isRunning: boolean;
  showCategoryCard: boolean;
  currentCategory: string | null;
  onFocusItem: (focusKey: string) => void;
}) {
  const [summary, setSummary] = useState<TimeSummaryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTodaySummary().then((data) => {
      setSummary(data);
      setLoaded(true);
    });
  }, [isRunning]);

  if (!loaded) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="text-sm">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (showCategoryCard && currentCategory) {
    const label =
      TIMER_CATEGORY_LABELS[currentCategory] ?? currentCategory;
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MusicIcon className="size-4" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.length > 0 && <TimeSummary entries={summary} onItemClick={onFocusItem} />}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Repertoire</CardTitle>
      </CardHeader>
      <CardContent>
        {summary.length > 0 ? (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Today&apos;s Practice
            </h4>
            <TimeSummary entries={summary} onItemClick={onFocusItem} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a piece or category from the bar above to focus your practice.
          </p>
        )}
      </CardContent>
    </Card>
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
