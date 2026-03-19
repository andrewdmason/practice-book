"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BookmarkIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  MessageSquareTextIcon,
  MusicIcon,
  TargetIcon,
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
  toggleGoalCompleted,
  getRepertoireOverview,
} from "@/app/(app)/focus-panel/actions";
import { createClient } from "@/lib/supabase/client";
import { TIMER_CATEGORY_LABELS } from "@/lib/timer-utils";
import type {
  Bookmark,
  Goal,
  MasteryLevel,
  MentionWithSource,
  RepertoireOverviewItem,
  Task,
  TimeSummaryEntry,
} from "@/lib/types";

export function RepertoireFocusPanel() {
  const { isRunning, currentTarget } = useTimer();
  const [focusedPieceId, setFocusedPieceId] = useState<string | null>(null);

  // Timer piece selection takes precedence over manual focus
  const activePieceId =
    currentTarget?.category === "piece" ? currentTarget.pieceId : focusedPieceId;
  const isFromOverview = currentTarget?.category !== "piece" && focusedPieceId !== null;

  if (activePieceId) {
    return (
      <PieceDetail
        pieceId={activePieceId}
        showBack={isFromOverview}
        onBack={() => setFocusedPieceId(null)}
      />
    );
  }

  return (
    <PracticeOverview
      isRunning={isRunning}
      currentCategory={currentTarget?.category ?? null}
      onSelectPiece={setFocusedPieceId}
    />
  );
}

// ---------------------------------------------------------------------------
// Piece Detail
// ---------------------------------------------------------------------------

function PieceDetail({
  pieceId,
  showBack,
  onBack,
}: {
  pieceId: string;
  showBack: boolean;
  onBack: () => void;
}) {
  const [piece, setPiece] = useState<{
    name: string;
    composer: string | null;
    mastery_level: string;
    bookmarks: Bookmark[];
  } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [mentions, setMentions] = useState<MentionWithSource[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const supabase = createClient();

    // Fetch piece + bookmarks
    supabase
      .from("pieces")
      .select("name, composer, mastery_level, bookmarks(*)")
      .eq("id", pieceId)
      .single()
      .then(({ data }) => {
        if (data) {
          setPiece({
            name: data.name,
            composer: data.composer,
            mastery_level: data.mastery_level,
            bookmarks: (data.bookmarks as Bookmark[]) ?? [],
          });
        }
      });

    // Fetch focus data (tasks, goals, mentions)
    getPieceFocusData(pieceId).then((data) => {
      setTasks(data.tasks);
      setGoals(data.goals);
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
        {showBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 -mt-1"
          >
            <ArrowLeftIcon className="size-3" />
            Back to overview
          </button>
        )}
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
        {/* Goals */}
        {loaded && goals.length > 0 && (
          <FocusSection
            icon={<TargetIcon className="size-3.5" />}
            title="Goals"
            count={goals.length}
          >
            {goals.map((goal) => (
              <GoalRow key={goal.id} goal={goal} onToggle={(completed) => {
                setGoals((prev) =>
                  prev.filter((g) => g.id !== goal.id)
                );
              }} />
            ))}
          </FocusSection>
        )}

        {/* Tasks */}
        {loaded && tasks.length > 0 && (
          <FocusSection
            icon={<CheckCircle2Icon className="size-3.5" />}
            title="Tasks"
            count={tasks.length}
          >
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={(completed) => {
                setTasks((prev) =>
                  prev.filter((t) => t.id !== task.id)
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

        {/* Bookmarks */}
        {piece.bookmarks.length > 0 && (
          <FocusSection
            icon={<BookmarkIcon className="size-3.5" />}
            title="Bookmarks"
          >
            {piece.bookmarks.map((bk) => (
              <div
                key={bk.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{bk.name}</span>
                <span className="text-muted-foreground text-xs">
                  {bk.measure_end
                    ? `mm. ${bk.measure_start}\u2013${bk.measure_end}`
                    : `m. ${bk.measure_start}`}
                </span>
              </div>
            ))}
          </FocusSection>
        )}

        {/* Empty state */}
        {loaded && goals.length === 0 && tasks.length === 0 && mentions.length === 0 && piece.bookmarks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No goals, tasks, or mentions yet.
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

function GoalRow({
  goal,
  onToggle,
}: {
  goal: Goal;
  onToggle: (completed: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer group">
      <Checkbox
        className="mt-0.5"
        checked={false}
        disabled={isPending}
        onCheckedChange={() => {
          onToggle(true);
          startTransition(() => {
            toggleGoalCompleted(goal.id, true);
          });
        }}
      />
      <span className={`flex-1 ${isPending ? "opacity-50" : ""}`}>
        {goal.text}
      </span>
    </label>
  );
}

function TaskRow({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (completed: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer group">
      <Checkbox
        className="mt-0.5"
        checked={false}
        disabled={isPending}
        onCheckedChange={() => {
          onToggle(true);
          startTransition(() => {
            toggleTaskCompleted(task.id, true);
          });
        }}
      />
      <span className={`flex-1 ${isPending ? "opacity-50" : ""}`}>
        {task.text}
      </span>
    </label>
  );
}

function MentionRow({ mention }: { mention: MentionWithSource }) {
  const href =
    mention.source_type === "lesson"
      ? `/lessons/${mention.source_id}`
      : `/`; // practice entries navigate to home feed

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
// Practice Overview
// ---------------------------------------------------------------------------

function PracticeOverview({
  isRunning,
  currentCategory,
  onSelectPiece,
}: {
  isRunning: boolean;
  currentCategory: string | null;
  onSelectPiece: (pieceId: string) => void;
}) {
  const [summary, setSummary] = useState<TimeSummaryEntry[]>([]);
  const [overview, setOverview] = useState<RepertoireOverviewItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getTodaySummary(), getRepertoireOverview()]).then(
      ([summaryData, overviewData]) => {
        setSummary(summaryData);
        setOverview(overviewData);
        setLoaded(true);
      }
    );
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

  if (isRunning && currentCategory) {
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
          {summary.length > 0 && <TimeSummary entries={summary} />}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Repertoire</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Today&apos;s Practice
            </h4>
            <TimeSummary entries={summary} />
          </div>
        )}

        {overview.length > 0 ? (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Active Pieces
            </h4>
            <div className="space-y-1">
              {overview.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectPiece(item.id)}
                  className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {item.name}
                      </p>
                      {item.composer && (
                        <p className="text-xs text-muted-foreground truncate">
                          {item.composer}
                        </p>
                      )}
                    </div>
                    <MasteryBadge level={item.mastery_level} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {item.last_played
                        ? `Last played ${formatRelativeDate(item.last_played)}`
                        : "Never played"}
                    </span>
                    {(item.open_tasks > 0 || item.open_goals > 0) && (
                      <span className="text-[11px] text-muted-foreground">
                        &middot;{" "}
                        {[
                          item.open_goals > 0 &&
                            `${item.open_goals} goal${item.open_goals !== 1 ? "s" : ""}`,
                          item.open_tasks > 0 &&
                            `${item.open_tasks} task${item.open_tasks !== 1 ? "s" : ""}`,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active pieces. Add pieces in Repertoire to get started.
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

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  }
  return formatDate(dateStr.slice(0, 10));
}
