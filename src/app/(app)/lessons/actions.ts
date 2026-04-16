"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localDate, getUserTimezone } from "@/lib/date-utils";
import { getTimeSummaryForDateRange } from "@/app/(app)/feed/actions";
import type { LessonDay, LessonEntryWithPiece, LessonTimeSummary } from "@/lib/types";

export async function getLessonsByDate(
  cursor?: string,
  limit = 10
): Promise<{ items: LessonDay[]; nextCursor: string | null }> {
  const supabase = await createClient();
  const tz = await getUserTimezone();
  const today = localDate(new Date(), tz);
  const beforeDate = cursor ?? today;

  // Find distinct dates that have lesson entries
  let dateQuery = supabase
    .from("lesson_entries")
    .select("date")
    .order("date", { ascending: false })
    .limit(limit * 5);

  if (cursor) {
    dateQuery = dateQuery.lt("date", beforeDate);
  } else {
    dateQuery = dateQuery.lte("date", beforeDate);
  }

  const { data: dateRows } = await dateQuery;
  const dateSet = new Set<string>();
  for (const row of dateRows ?? []) dateSet.add(row.date);

  const allDates = Array.from(dateSet)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

  if (allDates.length === 0) {
    return { items: [], nextCursor: null };
  }

  const { data: entries } = await supabase
    .from("lesson_entries")
    .select("*, pieces(name, composer)")
    .in("date", allDates)
    .order("date", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const byDate = new Map<string, LessonEntryWithPiece[]>();
  for (const d of allDates) byDate.set(d, []);

  for (const row of entries ?? []) {
    const piece = row.pieces as unknown as {
      name: string;
      composer: string | null;
    } | null;
    byDate.get(row.date)!.push({
      id: row.id,
      piece_id: row.piece_id,
      date: row.date,
      notes: row.notes,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
      piece_name: piece?.name ?? null,
      piece_composer: piece?.composer ?? null,
    });
  }

  // For each lesson date, compute the practice time summary between
  // the previous lesson date (exclusive) and this one (inclusive).
  // Find the previous lesson date globally so pagination doesn't break it.
  const oldestOnPage = allDates[allDates.length - 1];
  const { data: prevRows } = await supabase
    .from("lesson_entries")
    .select("date")
    .lt("date", oldestOnPage)
    .order("date", { ascending: false })
    .limit(1);
  const previousOffPage: string | null = prevRows?.[0]?.date ?? null;

  // Also grab earliest-ever practice_task date as a fallback start for the first-ever lesson
  const { data: earliestTask } = await supabase
    .from("practice_tasks")
    .select("date")
    .order("date", { ascending: true })
    .limit(1);
  const earliestPracticeDate: string | null = earliestTask?.[0]?.date ?? null;

  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const summaries = new Map<string, LessonTimeSummary>();
  // allDates is sorted descending; iterate and compute start as day after previous lesson.
  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    const prevLessonDate =
      i + 1 < allDates.length ? allDates[i + 1] : previousOffPage;
    const startDate = prevLessonDate
      ? addDays(prevLessonDate, 1)
      : earliestPracticeDate ?? date;
    // Guard against startDate > date (e.g. lesson has no predecessor + no prior practice)
    const effectiveStart = startDate > date ? date : startDate;
    summaries.set(date, await getTimeSummaryForDateRange(effectiveStart, date));
  }

  const items: LessonDay[] = allDates.map((date) => ({
    date,
    entries: byDate.get(date) ?? [],
    timeSummary: summaries.get(date) ?? {
      entries: [],
      totalSeconds: 0,
      dayCount: 0,
      calendarDays: 1,
    },
  }));

  const lastDate = allDates[allDates.length - 1];
  const { count: moreCount } = await supabase
    .from("lesson_entries")
    .select("id", { count: "exact", head: true })
    .lt("date", lastDate);

  return {
    items,
    nextCursor: (moreCount ?? 0) > 0 ? lastDate : null,
  };
}

export async function createLessonBatch(date?: string): Promise<void> {
  const supabase = await createClient();
  const tz = await getUserTimezone();
  const lessonDate = date ?? localDate(new Date(), tz);

  const [{ data: activePieces }, { data: existing }] = await Promise.all([
    supabase
      .from("pieces")
      .select("id")
      .eq("status", "active")
      .order("sort_order")
      .order("name"),
    supabase
      .from("lesson_entries")
      .select("piece_id")
      .eq("date", lessonDate),
  ]);

  const existingPieceIds = new Set<string>();
  let hasGeneral = false;
  for (const row of existing ?? []) {
    if (row.piece_id === null) hasGeneral = true;
    else existingPieceIds.add(row.piece_id);
  }

  const rows: Array<{
    piece_id: string | null;
    date: string;
    notes: string;
    sort_order: number;
  }> = [];
  if (!hasGeneral) {
    rows.push({ piece_id: null, date: lessonDate, notes: "", sort_order: 0 });
  }
  (activePieces ?? []).forEach((p, i) => {
    if (existingPieceIds.has(p.id)) return;
    rows.push({ piece_id: p.id, date: lessonDate, notes: "", sort_order: i + 1 });
  });

  if (rows.length === 0) {
    revalidatePath("/lessons");
    return;
  }

  const { error } = await supabase.from("lesson_entries").insert(rows);
  if (error) throw new Error(error.message);

  revalidatePath("/lessons");
}

export async function updateLessonEntry(
  id: string,
  patch: { piece_id?: string | null; notes?: string }
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_entries")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/lessons");
}

export async function deleteLessonEntry(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/lessons");
}
