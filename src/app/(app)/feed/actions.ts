"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  TimerCategory,
  TimeSummaryEntry,
  FeedDay,
  FeedPracticeEntry,
  FeedLesson,
  EntrySectionCategory,
} from "@/lib/types";

/**
 * Ensure today's practice entry and sections exist.
 * Creates the entry row and sections for each active piece + technique + sight_reading + general.
 */
export async function ensureTodayEntry(): Promise<string> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Get or create today's practice entry
  let { data: entry } = await supabase
    .from("practice_entries")
    .select("id")
    .eq("date", today)
    .single();

  if (!entry) {
    const { data: newEntry } = await supabase
      .from("practice_entries")
      .insert({ date: today })
      .select("id")
      .single();
    entry = newEntry;
  }

  if (!entry) throw new Error("Failed to create practice entry");

  // Fetch active pieces
  const { data: activePieces } = await supabase
    .from("pieces")
    .select("id")
    .eq("status", "active")
    .order("name");

  // Fetch existing sections
  const { data: existingSections } = await supabase
    .from("practice_entry_sections")
    .select("piece_id, category")
    .eq("practice_entry_id", entry.id);

  const existingKeys = new Set(
    (existingSections ?? []).map(
      (s) => `${s.category}:${s.piece_id ?? ""}`
    )
  );

  // Build sections to insert
  const toInsert: {
    practice_entry_id: string;
    piece_id: string | null;
    category: EntrySectionCategory;
    sort_order: number;
  }[] = [];

  let sortOrder = (existingSections ?? []).length;

  // Piece sections
  for (const piece of activePieces ?? []) {
    if (!existingKeys.has(`piece:${piece.id}`)) {
      toInsert.push({
        practice_entry_id: entry.id,
        piece_id: piece.id,
        category: "piece",
        sort_order: sortOrder++,
      });
    }
  }

  // Fixed category sections
  const fixedCategories: EntrySectionCategory[] = [
    "technique",
    "sight_reading",
    "general",
  ];
  for (const cat of fixedCategories) {
    if (!existingKeys.has(`${cat}:`)) {
      toInsert.push({
        practice_entry_id: entry.id,
        piece_id: null,
        category: cat,
        sort_order: sortOrder++,
      });
    }
  }

  if (toInsert.length > 0) {
    await supabase.from("practice_entry_sections").insert(toInsert);
  }

  return entry.id;
}

/**
 * Get time summary for a specific date.
 */
async function getTimeSummaryForDate(
  date: string
): Promise<TimeSummaryEntry[]> {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("practice_sessions")
    .select("id")
    .eq("date", date);

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  const { data: entries } = await supabase
    .from("timer_entries")
    .select("piece_id, category, started_at, ended_at")
    .in("session_id", sessionIds);

  if (!entries || entries.length === 0) return [];

  // Get piece names
  const pieceIds = [
    ...new Set(entries.filter((e) => e.piece_id).map((e) => e.piece_id!)),
  ];
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

  // Group and sum durations
  const groups = new Map<string, TimeSummaryEntry>();
  const now = Date.now();

  for (const entry of entries) {
    const key = entry.piece_id ?? entry.category;
    const start = new Date(entry.started_at).getTime();
    const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now;
    const seconds = Math.floor((end - start) / 1000);

    const existing = groups.get(key);
    if (existing) {
      existing.total_seconds += seconds;
    } else {
      groups.set(key, {
        category: entry.category as TimerCategory,
        piece_id: entry.piece_id,
        piece_name: entry.piece_id
          ? (pieceNames[entry.piece_id] ?? null)
          : null,
        total_seconds: seconds,
      });
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => b.total_seconds - a.total_seconds
  );
}

/**
 * Fetch a page of feed data, cursor-based by date descending.
 */
export async function getFeedPage(
  cursor?: string,
  limit = 7
): Promise<{ items: FeedDay[]; nextCursor: string | null }> {
  const supabase = await createClient();

  // Get distinct dates that have practice entries or lessons
  const today = new Date().toISOString().slice(0, 10);
  const beforeDate = cursor ?? today;

  // Fetch practice entries for the date range
  let peQuery = supabase
    .from("practice_entries")
    .select("id, date")
    .order("date", { ascending: false })
    .limit(limit);

  if (cursor) {
    peQuery = peQuery.lt("date", beforeDate);
  } else {
    peQuery = peQuery.lte("date", beforeDate);
  }

  const { data: practiceEntries } = await peQuery;

  // Also fetch lessons in the same date range
  let lessonsQuery = supabase
    .from("lessons")
    .select("id, date, content")
    .order("date", { ascending: false })
    .limit(limit * 3); // lessons can have multiple per day

  if (cursor) {
    lessonsQuery = lessonsQuery.lt("date", beforeDate);
  } else {
    lessonsQuery = lessonsQuery.lte("date", beforeDate);
  }

  const { data: lessons } = await lessonsQuery;

  // Collect all unique dates
  const dateSet = new Set<string>();
  for (const pe of practiceEntries ?? []) dateSet.add(pe.date);
  for (const l of lessons ?? []) dateSet.add(l.date);

  const allDates = Array.from(dateSet)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

  if (allDates.length === 0) {
    return { items: [], nextCursor: null };
  }

  // Build feed days
  const items: FeedDay[] = [];

  for (const date of allDates) {
    const pe = (practiceEntries ?? []).find((p) => p.date === date);

    let feedEntry: FeedPracticeEntry | null = null;
    if (pe) {
      // Fetch sections with piece info
      const { data: sections } = await supabase
        .from("practice_entry_sections")
        .select("id, practice_entry_id, piece_id, category, content, sort_order, pieces(name, composer)")
        .eq("practice_entry_id", pe.id)
        .order("sort_order");

      feedEntry = {
        id: pe.id,
        date: pe.date,
        sections: (sections ?? []).map((s) => ({
          id: s.id,
          practice_entry_id: s.practice_entry_id,
          piece_id: s.piece_id,
          category: s.category as EntrySectionCategory,
          content: s.content,
          sort_order: s.sort_order,
          piece_name: (s.pieces as unknown as { name: string; composer: string | null } | null)?.name ?? null,
          composer: (s.pieces as unknown as { name: string; composer: string | null } | null)?.composer ?? null,
        })),
      };
    }

    const dayLessons: FeedLesson[] = (lessons ?? [])
      .filter((l) => l.date === date)
      .map((l) => ({ id: l.id, date: l.date, content: l.content }));

    const timeSummary = await getTimeSummaryForDate(date);

    items.push({
      date,
      practiceEntry: feedEntry,
      lessons: dayLessons,
      timeSummary,
    });
  }

  // Determine next cursor
  const lastDate = allDates[allDates.length - 1];
  // Check if there are more entries before the last date
  const { count: moreCount } = await supabase
    .from("practice_entries")
    .select("id", { count: "exact", head: true })
    .lt("date", lastDate);

  const { count: moreLessonCount } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .lt("date", lastDate);

  const hasMore = (moreCount ?? 0) > 0 || (moreLessonCount ?? 0) > 0;

  return {
    items,
    nextCursor: hasMore ? lastDate : null,
  };
}

/**
 * Create a new lesson for a given date (defaults to today).
 */
export async function createLesson(date?: string): Promise<string> {
  const supabase = await createClient();
  const lessonDate = date ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("lessons")
    .insert({ date: lessonDate })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create lesson");
  }

  revalidatePath("/");
  revalidatePath("/lessons");
  return data.id;
}
