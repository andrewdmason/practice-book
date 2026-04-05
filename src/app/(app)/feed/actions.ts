"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localDate, getUserTimezone } from "@/lib/date-utils";
import type {
  TimerCategory,
  TimeSummaryEntry,
  LessonTimeSummary,
  FeedDay,
  FeedPracticeEntry,
  EntrySectionCategory,
  PracticeEntryType,
  SectionStatus,
  StatusChange,
} from "@/lib/types";

/**
 * Ensure fixed-category sections exist for a practice entry (technique, sight_reading, general).
 * Piece sections are created on-demand when the user adds them or when timer data exists.
 */
async function ensureSections(entryId: string): Promise<void> {
  const supabase = await createClient();

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

  // Fixed category sections only — piece sections are added on-demand
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
 * Create piece sections for any pieces that have timer data today but no section yet.
 */
async function ensurePieceSectionsFromTimerData(
  entryId: string,
  date: string
): Promise<void> {
  const supabase = await createClient();

  // Get piece IDs from timer entries
  const { data: sessions } = await supabase
    .from("practice_sessions")
    .select("id")
    .eq("date", date);

  let timerPieceIds: string[] = [];
  if (sessions && sessions.length > 0) {
    const { data: timerEntries } = await supabase
      .from("timer_entries")
      .select("piece_id")
      .in("session_id", sessions.map((s) => s.id))
      .not("piece_id", "is", null);
    timerPieceIds = (timerEntries ?? []).map((e) => e.piece_id!);
  }

  // Get piece IDs from practice tasks for this date
  const { data: taskPieces } = await supabase
    .from("practice_tasks")
    .select("piece_id")
    .eq("date", date);
  const taskPieceIds = (taskPieces ?? []).map((t) => t.piece_id);

  const timedPieceIds = [...new Set([...timerPieceIds, ...taskPieceIds])];
  if (timedPieceIds.length === 0) return;

  // Get existing piece sections
  const { data: existingSections } = await supabase
    .from("practice_entry_sections")
    .select("piece_id")
    .eq("practice_entry_id", entryId)
    .eq("category", "piece");

  const existingPieceIds = new Set((existingSections ?? []).map((s) => s.piece_id));
  const missingPieceIds = timedPieceIds.filter((id) => !existingPieceIds.has(id));

  if (missingPieceIds.length === 0) return;

  // Get max sort_order
  const { data: maxRow } = await supabase
    .from("practice_entry_sections")
    .select("sort_order")
    .eq("practice_entry_id", entryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  let sortOrder = (maxRow?.sort_order ?? 0) + 1;

  await supabase.from("practice_entry_sections").insert(
    missingPieceIds.map((pieceId) => ({
      practice_entry_id: entryId,
      piece_id: pieceId,
      category: "piece" as EntrySectionCategory,
      sort_order: sortOrder++,
    }))
  );
}

/**
 * Add a single section to an existing practice entry.
 * For fixed categories (technique, sight_reading, general), only one per entry is allowed.
 * For pieces, checks that the piece doesn't already have a section.
 */
export async function addSection(
  entryId: string,
  category: EntrySectionCategory,
  pieceId?: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Check for duplicates
  let query = supabase
    .from("practice_entry_sections")
    .select("id")
    .eq("practice_entry_id", entryId)
    .eq("category", category);

  if (category === "piece" && pieceId) {
    query = query.eq("piece_id", pieceId);
  }

  const { data: existing } = await query;
  if (existing && existing.length > 0) {
    // Section already exists (possibly hidden/empty) — treat as success
    return {};
  }

  // Get next sort_order
  const { data: maxRow } = await supabase
    .from("practice_entry_sections")
    .select("sort_order")
    .eq("practice_entry_id", entryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("practice_entry_sections").insert({
    practice_entry_id: entryId,
    category,
    piece_id: pieceId ?? null,
    sort_order: nextOrder,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return {};
}

/**
 * Ensure today's practice entry and sections exist.
 * Creates fixed-category sections (technique, sight_reading, general) and
 * piece sections only for pieces with existing timer data.
 */
export async function ensureTodayEntry(): Promise<string> {
  const supabase = await createClient();
  const tz = await getUserTimezone();
  const today = localDate(new Date(), tz);

  // Get or create today's practice entry
  // Use .limit(1) instead of .single() to avoid errors when duplicate rows exist.
  // Order by created_at so we always pick the same (oldest) entry when duplicates exist —
  // getFeedPage must use the same ordering to display the entry that has sections.
  const { data: entries } = await supabase
    .from("practice_entries")
    .select("id")
    .eq("date", today)
    .eq("type", "practice")
    .order("created_at")
    .limit(1);

  let entry = entries?.[0] ?? null;

  if (!entry) {
    const { data: newEntry } = await supabase
      .from("practice_entries")
      .insert({ date: today, type: "practice" })
      .select("id")
      .single();
    entry = newEntry;
  }

  if (!entry) throw new Error("Failed to create practice entry");

  // Remove stale empty piece sections left by the old ensureSections behavior.
  // Sections for pieces with timer data will be recreated below.
  await supabase
    .from("practice_entry_sections")
    .delete()
    .eq("practice_entry_id", entry.id)
    .eq("category", "piece")
    .is("content", null);

  await ensureSections(entry.id);

  // Create sections for pieces that have timer data but no section yet
  await ensurePieceSectionsFromTimerData(entry.id, today);

  // Clean up duplicate sections that can arise from concurrent requests.
  // Keep the oldest section for each category+piece_id pair.
  const { data: allSections } = await supabase
    .from("practice_entry_sections")
    .select("id, category, piece_id")
    .eq("practice_entry_id", entry.id)
    .order("created_at");

  if (allSections) {
    const seen = new Set<string>();
    const dupeIds: string[] = [];
    for (const s of allSections) {
      const key = `${s.category}:${s.piece_id ?? ""}`;
      if (seen.has(key)) {
        dupeIds.push(s.id);
      } else {
        seen.add(key);
      }
    }
    if (dupeIds.length > 0) {
      await supabase
        .from("practice_entry_sections")
        .delete()
        .in("id", dupeIds);
    }
  }

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
 * Get time summary for a specific date (used by other callers).
 */
async function getTimeSummaryForDate(
  date: string
): Promise<TimeSummaryEntry[]> {
  const result = await getTimeSummariesForDates([date]);
  return result.get(date) ?? [];
}

/**
 * Batch-fetch time summaries for multiple dates in 3 queries instead of 3N.
 */
async function getTimeSummariesForDates(
  dates: string[]
): Promise<Map<string, TimeSummaryEntry[]>> {
  const supabase = await createClient();
  const result = new Map<string, TimeSummaryEntry[]>();
  if (dates.length === 0) return result;

  // 1. Fetch all sessions for all dates at once
  const { data: sessions } = await supabase
    .from("practice_sessions")
    .select("id, date")
    .in("date", dates);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const sessionDateMap = new Map<string, string>();
  for (const s of sessions ?? []) sessionDateMap.set(s.id, s.date);

  // 2. Fetch timer entries and practice tasks in parallel
  const [timerResult, taskResult] = await Promise.all([
    sessionIds.length > 0
      ? supabase
          .from("timer_entries")
          .select("session_id, piece_id, category, started_at, ended_at")
          .in("session_id", sessionIds)
      : Promise.resolve({ data: [] as { session_id: string; piece_id: string | null; category: string; started_at: string; ended_at: string | null }[] }),
    supabase
      .from("practice_tasks")
      .select("piece_id, date, timer_seconds, timer_remaining_seconds")
      .in("date", dates),
  ]);

  const entries = timerResult.data ?? [];
  const tasks = taskResult.data ?? [];

  if (entries.length === 0 && tasks.length === 0) {
    for (const d of dates) result.set(d, []);
    return result;
  }

  // 3. Collect all piece IDs from both sources and fetch names
  const allPieceIds = new Set<string>();
  for (const e of entries) { if (e.piece_id) allPieceIds.add(e.piece_id); }
  for (const t of tasks) { if (t.piece_id) allPieceIds.add(t.piece_id); }

  let pieceNames: Record<string, string> = {};
  if (allPieceIds.size > 0) {
    const { data: pieces } = await supabase
      .from("pieces")
      .select("id, name")
      .in("id", [...allPieceIds]);
    if (pieces) {
      pieceNames = Object.fromEntries(pieces.map((p) => [p.id, p.name]));
    }
  }

  // Group by date, then by piece/category
  const now = Date.now();
  const dateGroups = new Map<string, Map<string, TimeSummaryEntry>>();

  for (const entry of entries) {
    const date = sessionDateMap.get(entry.session_id);
    if (!date) continue;

    if (!dateGroups.has(date)) dateGroups.set(date, new Map());
    const groups = dateGroups.get(date)!;

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

  // Add elapsed time from practice tasks (timer_seconds - timer_remaining_seconds)
  for (const task of tasks) {
    const elapsed = task.timer_seconds - task.timer_remaining_seconds;
    if (elapsed <= 0) continue;

    if (!dateGroups.has(task.date)) dateGroups.set(task.date, new Map());
    const groups = dateGroups.get(task.date)!;

    const key = task.piece_id;
    const existing = groups.get(key);
    if (existing) {
      existing.total_seconds += elapsed;
    } else {
      groups.set(key, {
        category: "piece" as TimerCategory,
        piece_id: task.piece_id,
        piece_name: pieceNames[task.piece_id] ?? null,
        total_seconds: elapsed,
      });
    }
  }

  for (const date of dates) {
    const groups = dateGroups.get(date);
    if (!groups) {
      result.set(date, []);
    } else {
      result.set(
        date,
        Array.from(groups.values()).sort(
          (a, b) => b.total_seconds - a.total_seconds
        )
      );
    }
  }

  return result;
}

/**
 * Aggregate time summaries across a date range (inclusive on both ends).
 * Returns a single set of TimeSummaryEntry[] plus the count of distinct practice days.
 */
async function getTimeSummaryForDateRange(
  startDate: string,
  endDate: string
): Promise<LessonTimeSummary> {
  const supabase = await createClient();

  // Calendar days in range (inclusive on both ends)
  const startMs = new Date(startDate + "T12:00:00").getTime();
  const endMs = new Date(endDate + "T12:00:00").getTime();
  const calendarDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);

  // Fetch sessions and practice tasks in parallel
  const [sessionsResult, tasksResult] = await Promise.all([
    supabase
      .from("practice_sessions")
      .select("id, date")
      .gte("date", startDate)
      .lte("date", endDate),
    supabase
      .from("practice_tasks")
      .select("piece_id, date, timer_seconds, timer_remaining_seconds")
      .gte("date", startDate)
      .lte("date", endDate),
  ]);

  const sessions = sessionsResult.data ?? [];
  const tasks = tasksResult.data ?? [];

  if (sessions.length === 0 && tasks.length === 0) {
    return { entries: [], totalSeconds: 0, dayCount: 0, calendarDays };
  }

  const sessionIds = sessions.map((s) => s.id);
  const distinctDates = new Set([
    ...sessions.map((s) => s.date),
    ...tasks.filter((t) => t.timer_seconds - t.timer_remaining_seconds > 0).map((t) => t.date),
  ]);

  const { data: entries } = sessionIds.length > 0
    ? await supabase
        .from("timer_entries")
        .select("session_id, piece_id, category, started_at, ended_at")
        .in("session_id", sessionIds)
    : { data: [] as { session_id: string; piece_id: string | null; category: string; started_at: string; ended_at: string | null }[] };

  // Collect all piece IDs from both sources
  const allPieceIds = new Set<string>();
  for (const e of entries ?? []) { if (e.piece_id) allPieceIds.add(e.piece_id); }
  for (const t of tasks) { if (t.piece_id) allPieceIds.add(t.piece_id); }

  let pieceNames: Record<string, string> = {};
  if (allPieceIds.size > 0) {
    const { data: pieces } = await supabase
      .from("pieces")
      .select("id, name")
      .in("id", [...allPieceIds]);
    if (pieces) {
      pieceNames = Object.fromEntries(pieces.map((p) => [p.id, p.name]));
    }
  }

  const now = Date.now();
  const groups = new Map<string, TimeSummaryEntry>();

  for (const entry of entries ?? []) {
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

  // Add elapsed time from practice tasks
  for (const task of tasks) {
    const elapsed = task.timer_seconds - task.timer_remaining_seconds;
    if (elapsed <= 0) continue;

    const key = task.piece_id;
    const existing = groups.get(key);
    if (existing) {
      existing.total_seconds += elapsed;
    } else {
      groups.set(key, {
        category: "piece" as TimerCategory,
        piece_id: task.piece_id,
        piece_name: pieceNames[task.piece_id] ?? null,
        total_seconds: elapsed,
      });
    }
  }

  const summaryEntries = Array.from(groups.values()).sort(
    (a, b) => b.total_seconds - a.total_seconds
  );
  const totalSeconds = summaryEntries.reduce((sum, e) => sum + e.total_seconds, 0);

  return {
    entries: summaryEntries,
    totalSeconds,
    dayCount: distinctDates.size,
    calendarDays,
  };
}

/**
 * Ensure tomorrow's practice entry exists and has piece sections
 * for any pieces that already have tasks scheduled for tomorrow.
 */
export async function ensureTomorrowEntry(): Promise<string> {
  const supabase = await createClient();
  const tz = await getUserTimezone();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = localDate(tomorrow, tz);

  // Get or create tomorrow's practice entry
  const { data: entries } = await supabase
    .from("practice_entries")
    .select("id")
    .eq("date", tomorrowDate)
    .eq("type", "practice")
    .order("created_at")
    .limit(1);

  let entry = entries?.[0] ?? null;

  if (!entry) {
    const { data: newEntry } = await supabase
      .from("practice_entries")
      .insert({ date: tomorrowDate, type: "practice" })
      .select("id")
      .single();
    entry = newEntry;
  }

  if (!entry) throw new Error("Failed to create tomorrow's practice entry");

  await ensureSections(entry.id);
  await ensurePieceSectionsFromTimerData(entry.id, tomorrowDate);

  return entry.id;
}

/**
 * Fetch tomorrow as a FeedDay for display in the feed.
 */
export async function getTomorrowFeedDay(): Promise<FeedDay> {
  const supabase = await createClient();
  const tz = await getUserTimezone();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = localDate(tomorrow, tz);

  // Ensure entry exists
  await ensureTomorrowEntry();

  // Fetch entries
  const { data: entries } = await supabase
    .from("practice_entries")
    .select("id, date, type")
    .eq("date", tomorrowDate)
    .eq("type", "practice")
    .order("created_at")
    .limit(1);

  const practiceEntry = entries?.[0] ?? null;

  let feedEntry: FeedPracticeEntry | null = null;
  if (practiceEntry) {
    const { data: sections } = await supabase
      .from("practice_entry_sections")
      .select("id, practice_entry_id, piece_id, category, content, sort_order, pieces(name, composer)")
      .eq("practice_entry_id", practiceEntry.id)
      .order("sort_order");

    feedEntry = {
      id: practiceEntry.id,
      date: practiceEntry.date,
      type: practiceEntry.type as PracticeEntryType,
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

  return {
    date: tomorrowDate,
    practiceEntry: feedEntry,
    lessons: [],
    timeSummary: [],
  };
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
  const tz = await getUserTimezone();
  const today = localDate(new Date(), tz);
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
    .order("date", { ascending: false })
    .order("created_at");

  if (typeFilter) {
    entriesQuery = entriesQuery.eq("type", typeFilter);
  }

  const { data: dateEntries } = await entriesQuery;

  // Batch-fetch all time summaries in one go (3 queries instead of 3*N)
  const timeSummaryMap = await getTimeSummariesForDates(allDates);

  // Create missing practice entries for dates with timer data but no entry
  const entriesByDate = new Map<string, typeof dateEntries>();
  for (const date of allDates) {
    entriesByDate.set(
      date,
      (dateEntries ?? []).filter((e) => e.date === date)
    );
  }

  for (const date of allDates) {
    const timeSummary = timeSummaryMap.get(date) ?? [];
    const forDate = entriesByDate.get(date) ?? [];
    const hasPractice = forDate.some((e) => e.type === "practice");
    if (!hasPractice && timeSummary.length > 0 && typeFilter !== "lesson") {
      const created = await ensureEntryForDate(date, timeSummary);
      forDate.push({ ...created, type: "practice" });
      entriesByDate.set(date, forDate);
    }
  }

  // Collect all entry IDs and batch-fetch sections in a single query
  const allFeedEntries: { id: string; date: string; type: string }[] = [];
  for (const date of allDates) {
    for (const e of entriesByDate.get(date) ?? []) {
      allFeedEntries.push(e);
    }
  }

  const allEntryIds = allFeedEntries.map((e) => e.id);
  const { data: allSections } = allEntryIds.length > 0
    ? await supabase
        .from("practice_entry_sections")
        .select("id, practice_entry_id, piece_id, category, content, sort_order, pieces(name, composer)")
        .in("practice_entry_id", allEntryIds)
        .order("sort_order")
    : { data: null };

  // Index sections by entry ID
  const sectionsByEntryId = new Map<string, typeof allSections>();
  for (const s of allSections ?? []) {
    const list = sectionsByEntryId.get(s.practice_entry_id) ?? [];
    list.push(s);
    sectionsByEntryId.set(s.practice_entry_id, list);
  }

  function buildFeedEntry(
    entry: { id: string; date: string; type: string }
  ): FeedPracticeEntry {
    const sections = sectionsByEntryId.get(entry.id) ?? [];
    return {
      id: entry.id,
      date: entry.date,
      type: entry.type as PracticeEntryType,
      sections: sections.map((s) => ({
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

  // Batch-fetch status changes for all dates
  const { data: allSnapshots } = await supabase
    .from("section_status_snapshots")
    .select("piece_id, section_id, old_status, new_status, snapshot_date")
    .in("snapshot_date", allDates)
    .order("created_at", { ascending: true });

  // Get section labels for snapshots
  const snapshotSectionIds = [...new Set((allSnapshots ?? []).map((s) => s.section_id))];
  const sectionLabelMap = new Map<string, string>();
  if (snapshotSectionIds.length > 0) {
    const { data: sectionLabels } = await supabase
      .from("piece_sections")
      .select("id, label")
      .in("id", snapshotSectionIds);
    for (const s of sectionLabels ?? []) {
      sectionLabelMap.set(s.id, s.label);
    }
  }

  // Group by date → piece_id, collapsing to net change per section
  const statusChangesByDatePiece = new Map<string, Record<string, StatusChange[]>>();
  for (const snap of allSnapshots ?? []) {
    const date = snap.snapshot_date;
    if (!statusChangesByDatePiece.has(date)) statusChangesByDatePiece.set(date, {});
    const byPiece = statusChangesByDatePiece.get(date)!;
    if (!byPiece[snap.piece_id]) byPiece[snap.piece_id] = [];

    const label = sectionLabelMap.get(snap.section_id) ?? "?";
    const existing = byPiece[snap.piece_id].find((c) => c.sectionLabel === label);
    if (existing) {
      existing.newStatus = snap.new_status as SectionStatus;
    } else {
      byPiece[snap.piece_id].push({
        sectionLabel: label,
        oldStatus: snap.old_status as SectionStatus,
        newStatus: snap.new_status as SectionStatus,
      });
    }
  }

  // Filter out net-zero changes
  for (const [date, byPiece] of statusChangesByDatePiece) {
    for (const pieceId of Object.keys(byPiece)) {
      byPiece[pieceId] = byPiece[pieceId].filter((c) => c.oldStatus !== c.newStatus);
      if (byPiece[pieceId].length === 0) delete byPiece[pieceId];
    }
    if (Object.keys(byPiece).length === 0) statusChangesByDatePiece.delete(date);
  }

  // Build feed days
  const items: FeedDay[] = [];

  for (const date of allDates) {
    const timeSummary = timeSummaryMap.get(date) ?? [];
    const forDate = entriesByDate.get(date) ?? [];
    const practiceEntry = forDate.find((e) => e.type === "practice");
    const lessonEntries = forDate.filter((e) => e.type === "lesson");

    const dayItem: FeedDay = {
      date,
      practiceEntry: practiceEntry ? buildFeedEntry(practiceEntry) : null,
      lessons: lessonEntries.map(buildFeedEntry),
      timeSummary,
    };

    const dayStatusChanges = statusChangesByDatePiece.get(date);
    if (dayStatusChanges) {
      dayItem.statusChangesByPiece = dayStatusChanges;
    }

    items.push(dayItem);
  }

  // Compute "practice since last lesson" summaries for each lesson on this page
  const allLessonsOnPage = items.flatMap((item) => item.lessons);
  if (allLessonsOnPage.length > 0) {
    // Fetch all lesson dates globally to find predecessors
    const { data: allLessonDates } = await supabase
      .from("practice_entries")
      .select("id, date")
      .eq("type", "lesson")
      .order("date", { ascending: false });

    const lessonDateList = (allLessonDates ?? []).map((l) => ({ id: l.id, date: l.date }));

    for (const item of items) {
      if (item.lessons.length === 0) continue;
      const summaries: Record<string, LessonTimeSummary> = {};

      for (const lesson of item.lessons) {
        // Find previous lesson date
        const idx = lessonDateList.findIndex((l) => l.id === lesson.id);
        const prevLesson = idx >= 0 && idx + 1 < lessonDateList.length
          ? lessonDateList[idx + 1]
          : null;

        // Range: day after previous lesson through this lesson's date
        let startDate: string;
        if (prevLesson) {
          const d = new Date(prevLesson.date + "T12:00:00");
          d.setDate(d.getDate() + 1);
          startDate = d.toISOString().slice(0, 10);
        } else {
          // No previous lesson — use earliest practice session date
          const { data: earliest } = await supabase
            .from("practice_sessions")
            .select("date")
            .order("date", { ascending: true })
            .limit(1);
          startDate = earliest?.[0]?.date ?? lesson.date;
        }

        summaries[lesson.id] = await getTimeSummaryForDateRange(startDate, lesson.date);
      }

      item.lessonTimeSummaries = summaries;
    }
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
 * Delete a practice entry section and its associated timer data.
 */
export async function deleteSection(sectionId: string): Promise<void> {
  const supabase = await createClient();

  // Look up section to find its piece_id/category and parent entry
  const { data: section } = await supabase
    .from("practice_entry_sections")
    .select("id, practice_entry_id, piece_id, category")
    .eq("id", sectionId)
    .single();

  if (!section) return;

  // Find timer entries for this section's date and category/piece
  const { data: entry } = await supabase
    .from("practice_entries")
    .select("date")
    .eq("id", section.practice_entry_id)
    .single();

  if (entry) {
    // Get sessions for this date
    const { data: sessions } = await supabase
      .from("practice_sessions")
      .select("id")
      .eq("date", entry.date);

    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map((s) => s.id);

      // Delete matching timer entries
      let timerQuery = supabase
        .from("timer_entries")
        .delete()
        .in("session_id", sessionIds);

      if (section.category === "piece" && section.piece_id) {
        timerQuery = timerQuery.eq("piece_id", section.piece_id);
      } else if (section.category !== "piece") {
        timerQuery = timerQuery.eq("category", section.category).is("piece_id", null);
      }

      await timerQuery;
    }
  }

  // Delete the section itself
  await supabase
    .from("practice_entry_sections")
    .delete()
    .eq("id", sectionId);

  revalidatePath("/");
}

/**
 * Fetch individual timer entries for a given section (date + category + piece).
 */
export async function getTimerEntriesForSection(
  date: string,
  category: TimerCategory,
  pieceId: string | null
): Promise<{ id: string; started_at: string; ended_at: string | null; duration_seconds: number }[]> {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("practice_sessions")
    .select("id")
    .eq("date", date);

  if (!sessions || sessions.length === 0) return [];

  let query = supabase
    .from("timer_entries")
    .select("id, started_at, ended_at")
    .in("session_id", sessions.map((s) => s.id))
    .eq("category", category);

  if (category === "piece" && pieceId) {
    query = query.eq("piece_id", pieceId);
  } else if (category !== "piece") {
    query = query.is("piece_id", null);
  }

  const { data: entries } = await query.order("started_at");
  if (!entries) return [];

  const now = Date.now();
  return entries.map((e) => {
    const start = new Date(e.started_at).getTime();
    const end = e.ended_at ? new Date(e.ended_at).getTime() : now;
    return {
      id: e.id,
      started_at: e.started_at,
      ended_at: e.ended_at,
      duration_seconds: Math.floor((end - start) / 1000),
    };
  });
}

/**
 * Update a timer entry's duration by recomputing ended_at from started_at + duration.
 */
export async function updateTimerEntryDuration(
  entryId: string,
  durationSeconds: number
): Promise<void> {
  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("timer_entries")
    .select("started_at")
    .eq("id", entryId)
    .single();

  if (!entry) return;

  const endedAt = new Date(
    new Date(entry.started_at).getTime() + durationSeconds * 1000
  ).toISOString();

  await supabase
    .from("timer_entries")
    .update({ ended_at: endedAt })
    .eq("id", entryId);

  revalidatePath("/");
}

/**
 * Add a manual timer entry for a forgotten practice session.
 */
export async function addManualTimerEntry(
  date: string,
  category: TimerCategory,
  pieceId: string | null,
  durationSeconds: number
): Promise<{ id: string }> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const endedAt = new Date(
    Date.now() + durationSeconds * 1000
  ).toISOString();

  // Create a closed session for this date
  const { data: session } = await supabase
    .from("practice_sessions")
    .insert({ date, started_at: now, ended_at: now })
    .select("id")
    .single();

  if (!session) throw new Error("Failed to create session");

  const { data: entry } = await supabase
    .from("timer_entries")
    .insert({
      session_id: session.id,
      piece_id: pieceId,
      category,
      started_at: now,
      ended_at: endedAt,
    })
    .select("id")
    .single();

  if (!entry) throw new Error("Failed to create timer entry");

  // Ensure a piece section exists so it renders in the feed
  if (category === "piece" && pieceId) {
    const entryId = await ensureTodayEntry();
    const { data: existing } = await supabase
      .from("practice_entry_sections")
      .select("id")
      .eq("practice_entry_id", entryId)
      .eq("category", "piece")
      .eq("piece_id", pieceId)
      .limit(1);

    if (!existing || existing.length === 0) {
      const { data: maxRow } = await supabase
        .from("practice_entry_sections")
        .select("sort_order")
        .eq("practice_entry_id", entryId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      await supabase.from("practice_entry_sections").insert({
        practice_entry_id: entryId,
        piece_id: pieceId,
        category: "piece",
        sort_order: (maxRow?.sort_order ?? 0) + 1,
      });
    }
  }

  revalidatePath("/");
  return { id: entry.id };
}

/**
 * Delete a timer entry and clean up orphaned sessions.
 */
export async function deleteTimerEntry(entryId: string): Promise<void> {
  const supabase = await createClient();

  // Get the session ID before deleting
  const { data: entry } = await supabase
    .from("timer_entries")
    .select("session_id")
    .eq("id", entryId)
    .single();

  if (!entry) return;

  await supabase.from("timer_entries").delete().eq("id", entryId);

  // Clean up orphaned session
  const { data: remaining } = await supabase
    .from("timer_entries")
    .select("id")
    .eq("session_id", entry.session_id)
    .limit(1);

  if (!remaining || remaining.length === 0) {
    await supabase
      .from("practice_sessions")
      .delete()
      .eq("id", entry.session_id);
  }

  revalidatePath("/");
}

/**
 * Delete a lesson and all its sections.
 */
export async function deleteLesson(lessonId: string): Promise<void> {
  const supabase = await createClient();

  // Delete all sections first
  await supabase
    .from("practice_entry_sections")
    .delete()
    .eq("practice_entry_id", lessonId);

  // Delete the lesson entry
  await supabase
    .from("practice_entries")
    .delete()
    .eq("id", lessonId)
    .eq("type", "lesson");

  revalidatePath("/");
}

/**
 * Create a new lesson for a given date (defaults to today).
 * Creates a practice_entry with type='lesson' and auto-creates sections.
 */
export async function createLesson(date?: string): Promise<string> {
  const supabase = await createClient();
  const tz = await getUserTimezone();
  const lessonDate = date ?? localDate(new Date(), tz);

  const { data, error } = await supabase
    .from("practice_entries")
    .insert({ date: lessonDate, type: "lesson" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create lesson");
  }

  // Lessons start with only a general notes section.
  // Pieces and other categories are added manually by the user.
  await supabase.from("practice_entry_sections").insert({
    practice_entry_id: data.id,
    piece_id: null,
    category: "general",
    sort_order: 0,
  });

  revalidatePath("/");
  return data.id;
}
