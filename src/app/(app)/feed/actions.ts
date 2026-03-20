"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/date-utils";
import type {
  TimerCategory,
  TimeSummaryEntry,
  FeedDay,
  FeedPracticeEntry,
  EntrySectionCategory,
  PracticeEntryType,
} from "@/lib/types";

/**
 * Ensure sections exist for a practice entry (technique, sight_reading, general + active pieces).
 */
async function ensureSections(entryId: string): Promise<void> {
  const supabase = await createClient();

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
    .eq("practice_entry_id", entryId);

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
        practice_entry_id: entryId,
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
        practice_entry_id: entryId,
        piece_id: null,
        category: cat,
        sort_order: sortOrder++,
      });
    }
  }

  if (toInsert.length > 0) {
    await supabase.from("practice_entry_sections").insert(toInsert);
  }
}

/**
 * Ensure today's practice entry and sections exist.
 * Creates the entry row and sections for each active piece + technique + sight_reading + general.
 */
export async function ensureTodayEntry(): Promise<string> {
  const supabase = await createClient();
  const today = localDate();

  // Get or create today's practice entry
  let { data: entry } = await supabase
    .from("practice_entries")
    .select("id")
    .eq("date", today)
    .eq("type", "practice")
    .single();

  if (!entry) {
    const { data: newEntry } = await supabase
      .from("practice_entries")
      .insert({ date: today, type: "practice" })
      .select("id")
      .single();
    entry = newEntry;
  }

  if (!entry) throw new Error("Failed to create practice entry");

  await ensureSections(entry.id);

  return entry.id;
}

/**
 * Ensure a practice entry and sections exist for a historical date,
 * based on what was practiced that day (from timer data).
 */
async function ensureEntryForDate(
  date: string,
  timeSummary: TimeSummaryEntry[]
): Promise<{ id: string; date: string }> {
  const supabase = await createClient();

  // Create entry
  const { data: entry } = await supabase
    .from("practice_entries")
    .insert({ date, type: "practice" })
    .select("id, date")
    .single();

  if (!entry) throw new Error(`Failed to create practice entry for ${date}`);

  // Create sections based on what was practiced
  const sections: {
    practice_entry_id: string;
    piece_id: string | null;
    category: EntrySectionCategory;
    sort_order: number;
  }[] = [];

  let sortOrder = 0;

  // Add technique section if practiced
  if (timeSummary.some((t) => t.category === "technique")) {
    sections.push({
      practice_entry_id: entry.id,
      piece_id: null,
      category: "technique",
      sort_order: sortOrder++,
    });
  }

  // Add sight reading section if practiced
  if (timeSummary.some((t) => t.category === "sight_reading")) {
    sections.push({
      practice_entry_id: entry.id,
      piece_id: null,
      category: "sight_reading",
      sort_order: sortOrder++,
    });
  }

  // Add piece sections for each piece practiced
  for (const t of timeSummary) {
    if (t.category === "piece" && t.piece_id) {
      sections.push({
        practice_entry_id: entry.id,
        piece_id: t.piece_id,
        category: "piece",
        sort_order: sortOrder++,
      });
    }
  }

  if (sections.length > 0) {
    await supabase.from("practice_entry_sections").insert(sections);
  }

  return entry;
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
  limit = 7,
  typeFilter?: "practice" | "lesson"
): Promise<{ items: FeedDay[]; nextCursor: string | null }> {
  const supabase = await createClient();

  // Get distinct dates that have practice entries, lessons, or timer sessions
  const today = localDate();
  const beforeDate = cursor ?? today;

  // Fetch all entries (practice + lesson) for the date range
  let peQuery = supabase
    .from("practice_entries")
    .select("id, date, type")
    .order("date", { ascending: false })
    .limit(limit * 3); // multiple entries per day possible

  if (typeFilter) {
    peQuery = peQuery.eq("type", typeFilter);
  }

  if (cursor) {
    peQuery = peQuery.lt("date", beforeDate);
  } else {
    peQuery = peQuery.lte("date", beforeDate);
  }

  const { data: allEntries } = await peQuery;

  // Also fetch dates from practice sessions (timer data without notes)
  // Skip when filtering to lessons only (lessons don't have timer data)
  let sessionDates: { date: string }[] | null = null;
  if (typeFilter !== "lesson") {
    let sessionsQuery = supabase
      .from("practice_sessions")
      .select("date")
      .order("date", { ascending: false })
      .limit(limit);

    if (cursor) {
      sessionsQuery = sessionsQuery.lt("date", beforeDate);
    } else {
      sessionsQuery = sessionsQuery.lte("date", beforeDate);
    }

    const result = await sessionsQuery;
    sessionDates = result.data;
  }

  // Collect all unique dates
  const dateSet = new Set<string>();
  for (const pe of allEntries ?? []) dateSet.add(pe.date);
  for (const s of sessionDates ?? []) dateSet.add(s.date);

  const allDates = Array.from(dateSet)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

  if (allDates.length === 0) {
    return { items: [], nextCursor: null };
  }

  // Fetch all entries for the resolved dates (the initial query may have missed some
  // due to its limit, especially when dates have many duplicate entries)
  let entriesQuery = supabase
    .from("practice_entries")
    .select("id, date, type")
    .in("date", allDates)
    .order("date", { ascending: false });

  if (typeFilter) {
    entriesQuery = entriesQuery.eq("type", typeFilter);
  }

  const { data: dateEntries } = await entriesQuery;

  // Build feed days
  const items: FeedDay[] = [];

  for (const date of allDates) {
    const timeSummary = await getTimeSummaryForDate(date);

    const entriesForDate = (dateEntries ?? []).filter((e) => e.date === date);
    let practiceEntry = entriesForDate.find((e) => e.type === "practice");
    const lessonEntries = entriesForDate.filter((e) => e.type === "lesson");

    // For days with timer data but no practice entry, create one with sections
    if (!practiceEntry && timeSummary.length > 0 && typeFilter !== "lesson") {
      practiceEntry = { ...(await ensureEntryForDate(date, timeSummary)), type: "practice" };
    }

    async function buildFeedEntry(
      entry: { id: string; date: string; type: string }
    ): Promise<FeedPracticeEntry> {
      const { data: sections } = await supabase
        .from("practice_entry_sections")
        .select("id, practice_entry_id, piece_id, category, content, sort_order, time_override_seconds, pieces(name, composer)")
        .eq("practice_entry_id", entry.id)
        .order("sort_order");

      return {
        id: entry.id,
        date: entry.date,
        type: entry.type as PracticeEntryType,
        sections: (sections ?? []).map((s) => ({
          id: s.id,
          practice_entry_id: s.practice_entry_id,
          piece_id: s.piece_id,
          category: s.category as EntrySectionCategory,
          content: s.content,
          sort_order: s.sort_order,
          piece_name: (s.pieces as unknown as { name: string; composer: string | null } | null)?.name ?? null,
          composer: (s.pieces as unknown as { name: string; composer: string | null } | null)?.composer ?? null,
          time_override_seconds: s.time_override_seconds,
        })),
      };
    }

    const feedPractice = practiceEntry ? await buildFeedEntry(practiceEntry) : null;
    const feedLessons = await Promise.all(lessonEntries.map(buildFeedEntry));

    items.push({
      date,
      practiceEntry: feedPractice,
      lessons: feedLessons,
      timeSummary,
    });
  }

  // Determine next cursor
  const lastDate = allDates[allDates.length - 1];
  // Check if there are more entries before the last date
  let moreEntriesQuery = supabase
    .from("practice_entries")
    .select("id", { count: "exact", head: true })
    .lt("date", lastDate);

  if (typeFilter) {
    moreEntriesQuery = moreEntriesQuery.eq("type", typeFilter);
  }

  const { count: moreCount } = await moreEntriesQuery;

  let hasMore = (moreCount ?? 0) > 0;

  if (!hasMore && typeFilter !== "lesson") {
    const { count: moreSessionCount } = await supabase
      .from("practice_sessions")
      .select("id", { count: "exact", head: true })
      .lt("date", lastDate);
    hasMore = (moreSessionCount ?? 0) > 0;
  }

  return {
    items,
    nextCursor: hasMore ? lastDate : null,
  };
}

/**
 * Update the time override for a practice entry section.
 * Pass null to clear the override and revert to timer-derived time.
 */
export async function updateSectionTime(
  sectionId: string,
  totalSeconds: number | null
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("practice_entry_sections")
    .update({ time_override_seconds: totalSeconds })
    .eq("id", sectionId);
  revalidatePath("/");
}

/**
 * Create a new lesson for a given date (defaults to today).
 * Creates a practice_entry with type='lesson' and auto-creates sections.
 */
export async function createLesson(date?: string): Promise<string> {
  const supabase = await createClient();
  const lessonDate = date ?? localDate();

  const { data, error } = await supabase
    .from("practice_entries")
    .insert({ date: lessonDate, type: "lesson" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create lesson");
  }

  await ensureSections(data.id);

  revalidatePath("/");
  return data.id;
}
