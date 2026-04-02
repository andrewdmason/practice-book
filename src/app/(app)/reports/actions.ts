"use server";

import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/date-utils";
import type {
  WeeklyPracticeData,
  PieceBreakdownData,
  StreakData,
  TimerCategory,
  PieceWeeklyCumulativeData,
  PieceOption,
  CompletedTaskMarker,
} from "@/lib/types";

/**
 * Get the start of the week for a given date string (YYYY-MM-DD).
 * @param weekStartDay 0=Sun, 1=Mon, ... 6=Sat (default 1=Monday)
 */
function getWeekStart(dateStr: string, weekStartDay: number = 1): string {
  const d = new Date(dateStr + "T12:00:00"); // noon to avoid DST edge cases
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = ((day - weekStartDay + 7) % 7);
  d.setDate(d.getDate() - diff);
  return localDate(d);
}

/**
 * Format a date string as a short label like "Mar 10".
 */
function weekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Last 13 weeks of total practice time per week.
 */
export async function getWeeklyPracticeData(weekStartDay: number = 1): Promise<WeeklyPracticeData[]> {
  const supabase = await createClient();

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 13 * 7);
  const cutoffStr = localDate(cutoff);

  const { data: entries } = await supabase
    .from("timer_entries")
    .select("started_at, ended_at, practice_sessions!inner(date)")
    .gte("practice_sessions.date", cutoffStr)
    .not("ended_at", "is", null);

  // Group by week
  const weekMap = new Map<string, number>();

  for (const entry of entries ?? []) {
    const session = entry.practice_sessions as unknown as { date: string };
    const ws = getWeekStart(session.date, weekStartDay);
    const start = new Date(entry.started_at).getTime();
    const end = new Date(entry.ended_at!).getTime();
    const seconds = Math.floor((end - start) / 1000);
    weekMap.set(ws, (weekMap.get(ws) ?? 0) + seconds);
  }

  // Fill in all 13 weeks
  const result: WeeklyPracticeData[] = [];
  const currentWeekStart = getWeekStart(localDate(now), weekStartDay);

  for (let i = 12; i >= 0; i--) {
    const d = new Date(currentWeekStart + "T00:00:00");
    d.setDate(d.getDate() - i * 7);
    const ws = localDate(d);
    result.push({
      weekStart: ws,
      weekLabel: weekLabel(ws),
      totalSeconds: weekMap.get(ws) ?? 0,
    });
  }

  return result;
}

/**
 * Time per piece/category for a given time range.
 */
export async function getPieceBreakdownData(
  range: "7d" | "30d" | "90d" | "all"
): Promise<PieceBreakdownData[]> {
  const supabase = await createClient();

  let query = supabase
    .from("timer_entries")
    .select(
      "piece_id, category, started_at, ended_at, practice_sessions!inner(date)"
    )
    .not("ended_at", "is", null);

  if (range !== "all") {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    query = query.gte("practice_sessions.date", localDate(cutoff));
  }

  const { data: entries } = await query;

  if (!entries || entries.length === 0) return [];

  // Group by piece_id or category
  const groups = new Map<string, { seconds: number; pieceId: string | null; category: TimerCategory }>();

  for (const entry of entries) {
    const key = entry.piece_id ?? entry.category;
    const start = new Date(entry.started_at).getTime();
    const end = new Date(entry.ended_at!).getTime();
    const seconds = Math.floor((end - start) / 1000);

    const existing = groups.get(key);
    if (existing) {
      existing.seconds += seconds;
    } else {
      groups.set(key, {
        seconds,
        pieceId: entry.piece_id,
        category: entry.category as TimerCategory,
      });
    }
  }

  // Resolve piece names
  const pieceIds = [...groups.values()]
    .filter((g) => g.pieceId)
    .map((g) => g.pieceId!);

  let pieceNames: Record<string, string> = {};
  if (pieceIds.length > 0) {
    const { data: pieces } = await supabase
      .from("pieces")
      .select("id, name")
      .in("id", pieceIds);
    if (pieces) {
      pieceNames = Object.fromEntries(pieces.map((p) => [p.id, p.name]));
    }
  }

  const categoryLabels: Record<string, string> = {
    technique: "Technique",
    sight_reading: "Sight Reading",
  };

  return [...groups.entries()]
    .map(([key, g]) => ({
      pieceId: g.pieceId,
      label: g.pieceId
        ? (pieceNames[g.pieceId] ?? "Unknown Piece")
        : (categoryLabels[key] ?? key),
      totalSeconds: g.seconds,
      category: g.category,
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);
}

/**
 * Current streak and this-week breakdown.
 */
export async function getStreakData(): Promise<StreakData> {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("practice_sessions")
    .select("date")
    .order("date", { ascending: false });

  const practicedDates = new Set(
    (sessions ?? []).map((s) => s.date)
  );

  // Current streak: walk backward from today
  const today = new Date();
  const todayStr = localDate(today);

  let currentStreak = 0;
  const d = new Date(today);

  // If today has no session, start from yesterday
  if (!practicedDates.has(todayStr)) {
    d.setDate(d.getDate() - 1);
  }

  while (true) {
    const ds = localDate(d);
    if (practicedDates.has(ds)) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // This week days (Mon-Sun)
  const monday = getWeekStart(todayStr);
  const thisWeekDays: boolean[] = [];
  let daysPracticedThisWeek = 0;

  for (let i = 0; i < 7; i++) {
    const wd = new Date(monday + "T00:00:00");
    wd.setDate(wd.getDate() + i);
    const practiced = practicedDates.has(localDate(wd));
    thisWeekDays.push(practiced);
    if (practiced) daysPracticedThisWeek++;
  }

  return { currentStreak, daysPracticedThisWeek, thisWeekDays };
}

/**
 * Get all pieces that have timer entries (for the piece selector).
 */
export async function getPiecesWithTimerData(): Promise<PieceOption[]> {
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("timer_entries")
    .select("piece_id")
    .not("piece_id", "is", null)
    .not("ended_at", "is", null);

  if (!entries || entries.length === 0) return [];

  const pieceIds = [...new Set(entries.map((e) => e.piece_id!))];

  const { data: pieces } = await supabase
    .from("pieces")
    .select("id, name, composer")
    .in("id", pieceIds)
    .order("name");

  return (pieces ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    composer: p.composer,
  }));
}

/**
 * Cumulative weekly practice time for a single piece.
 */
export async function getPieceCumulativeData(
  pieceId: string
): Promise<PieceWeeklyCumulativeData[]> {
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("timer_entries")
    .select("started_at, ended_at, practice_sessions!inner(date)")
    .eq("piece_id", pieceId)
    .not("ended_at", "is", null);

  if (!entries || entries.length === 0) return [];

  // Group by week
  const weekMap = new Map<string, number>();

  for (const entry of entries) {
    const session = entry.practice_sessions as unknown as { date: string };
    const monday = getWeekStart(session.date);
    const start = new Date(entry.started_at).getTime();
    const end = new Date(entry.ended_at!).getTime();
    const seconds = Math.floor((end - start) / 1000);
    weekMap.set(monday, (weekMap.get(monday) ?? 0) + seconds);
  }

  // Sort weeks chronologically and build cumulative
  const sortedWeeks = [...weekMap.keys()].sort();

  // Fill in gaps between first and last week
  const firstMonday = sortedWeeks[0];
  const now = new Date();
  const lastMonday = getWeekStart(localDate(now));

  const allWeeks: string[] = [];
  const d = new Date(firstMonday + "T00:00:00");
  while (localDate(d) <= lastMonday) {
    allWeeks.push(localDate(d));
    d.setDate(d.getDate() + 7);
  }

  let cumulative = 0;
  return allWeeks.map((ws) => {
    const weekSec = weekMap.get(ws) ?? 0;
    cumulative += weekSec;
    return {
      weekStart: ws,
      weekLabel: weekLabel(ws),
      weekSeconds: weekSec,
      cumulativeSeconds: cumulative,
    };
  });
}

/**
 * Get completed tasks for a piece, grouped by week for chart markers.
 */
export async function getCompletedTasksForPiece(
  pieceId: string,
  cumulativeData: PieceWeeklyCumulativeData[]
): Promise<CompletedTaskMarker[]> {
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, text, completed_at")
    .eq("piece_id", pieceId)
    .not("completed_at", "is", null);

  if (!tasks || tasks.length === 0) return [];

  // Build a map from weekStart to cumulative hours
  const cumulativeMap = new Map(
    cumulativeData.map((d) => [
      d.weekStart,
      Math.round((d.cumulativeSeconds / 3600) * 10) / 10,
    ])
  );

  // Group tasks by week
  const weekGroups = new Map<
    string,
    { id: string; text: string; completedAt: string }[]
  >();

  for (const task of tasks) {
    const completedDate = task.completed_at!.slice(0, 10);
    const monday = getWeekStart(completedDate);
    const group = weekGroups.get(monday) ?? [];
    group.push({
      id: task.id,
      text: task.text,
      completedAt: task.completed_at!,
    });
    weekGroups.set(monday, group);
  }

  return [...weekGroups.entries()]
    .map(([ws, groupTasks]) => ({
      weekStart: ws,
      weekLabel: weekLabel(ws),
      cumulativeHours: cumulativeMap.get(ws) ?? 0,
      tasks: groupTasks,
    }))
    .filter((m) => cumulativeMap.has(m.weekStart));
}
