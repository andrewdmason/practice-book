"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  WeeklyPracticeData,
  PieceBreakdownData,
  StreakData,
  TimerCategory,
} from "@/lib/types";

/**
 * Get the Monday of the week for a given date string (YYYY-MM-DD).
 */
function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
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
export async function getWeeklyPracticeData(): Promise<WeeklyPracticeData[]> {
  const supabase = await createClient();

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 13 * 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data: entries } = await supabase
    .from("timer_entries")
    .select("started_at, ended_at, practice_sessions!inner(date)")
    .gte("practice_sessions.date", cutoffStr)
    .not("ended_at", "is", null);

  // Group by week
  const weekMap = new Map<string, number>();

  for (const entry of entries ?? []) {
    const session = entry.practice_sessions as unknown as { date: string };
    const monday = getMonday(session.date);
    const start = new Date(entry.started_at).getTime();
    const end = new Date(entry.ended_at!).getTime();
    const seconds = Math.floor((end - start) / 1000);
    weekMap.set(monday, (weekMap.get(monday) ?? 0) + seconds);
  }

  // Fill in all 13 weeks
  const result: WeeklyPracticeData[] = [];
  const todayMonday = getMonday(now.toISOString().slice(0, 10));

  for (let i = 12; i >= 0; i--) {
    const d = new Date(todayMonday + "T00:00:00");
    d.setDate(d.getDate() - i * 7);
    const ws = d.toISOString().slice(0, 10);
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
    query = query.gte("practice_sessions.date", cutoff.toISOString().slice(0, 10));
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
  const todayStr = today.toISOString().slice(0, 10);

  let currentStreak = 0;
  const d = new Date(today);

  // If today has no session, start from yesterday
  if (!practicedDates.has(todayStr)) {
    d.setDate(d.getDate() - 1);
  }

  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if (practicedDates.has(ds)) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // This week days (Mon-Sun)
  const monday = getMonday(todayStr);
  const thisWeekDays: boolean[] = [];
  let daysPracticedThisWeek = 0;

  for (let i = 0; i < 7; i++) {
    const wd = new Date(monday + "T00:00:00");
    wd.setDate(wd.getDate() + i);
    const practiced = practicedDates.has(wd.toISOString().slice(0, 10));
    thisWeekDays.push(practiced);
    if (practiced) daysPracticedThisWeek++;
  }

  return { currentStreak, daysPracticedThisWeek, thisWeekDays };
}
