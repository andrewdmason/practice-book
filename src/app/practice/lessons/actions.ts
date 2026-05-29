"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localDate, getUserTimezone } from "@/lib/date-utils";
import { getTimeSummaryForDateRange } from "@/app/practice/feed/actions";
import type {
  LessonDay,
  LessonEntryWithPiece,
  LessonTimeSummary,
  LessonWithEntries,
  LessonIndexEntry,
} from "@/lib/types";

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

async function getEarliestPracticeDate(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("practice_tasks")
    .select("date")
    .order("date", { ascending: true })
    .limit(1);
  return data?.[0]?.date ?? null;
}

export async function getLessonsByDate(
  cursor?: string,
  limit = 10
): Promise<{ items: LessonDay[]; nextCursor: string | null }> {
  const supabase = await createClient();
  const tz = await getUserTimezone();
  const today = localDate(new Date(), tz);
  const beforeDate = cursor ?? today;

  let dateQuery = supabase
    .from("lessons")
    .select("date")
    .not("date", "is", null)
    .not("completed_at", "is", null)
    .order("date", { ascending: false })
    .limit(limit * 5);

  if (cursor) {
    dateQuery = dateQuery.lt("date", beforeDate);
  } else {
    dateQuery = dateQuery.lte("date", beforeDate);
  }

  const { data: dateRows } = await dateQuery;
  const dateSet = new Set<string>();
  for (const row of dateRows ?? []) {
    if (row.date) dateSet.add(row.date);
  }

  const allDates = Array.from(dateSet)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

  if (allDates.length === 0) {
    return { items: [], nextCursor: null };
  }

  const { data: entries } = await supabase
    .from("lesson_entries")
    .select("*, pieces(name, composer), lessons!inner(date, completed_at)")
    .in("lessons.date", allDates)
    .not("lessons.completed_at", "is", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const byDate = new Map<string, LessonEntryWithPiece[]>();
  for (const d of allDates) byDate.set(d, []);

  for (const row of entries ?? []) {
    const piece = row.pieces as unknown as {
      name: string;
      composer: string | null;
    } | null;
    const lesson = row.lessons as unknown as {
      date: string;
      completed_at: string | null;
    } | null;
    if (!lesson?.date) continue;
    byDate.get(lesson.date)?.push({
      id: row.id,
      lesson_id: row.lesson_id,
      piece_id: row.piece_id,
      date: lesson.date,
      notes: row.notes,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
      piece_name: piece?.name ?? null,
      piece_composer: piece?.composer ?? null,
    });
  }

  const oldestOnPage = allDates[allDates.length - 1];
  const { data: prevRows } = await supabase
    .from("lessons")
    .select("date")
    .not("date", "is", null)
    .not("completed_at", "is", null)
    .lt("date", oldestOnPage)
    .order("date", { ascending: false })
    .limit(1);
  const previousOffPage: string | null = prevRows?.[0]?.date ?? null;

  const earliestPracticeDate = await getEarliestPracticeDate();

  const summaries = new Map<string, LessonTimeSummary>();
  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    const prevLessonDate =
      i + 1 < allDates.length ? allDates[i + 1] : previousOffPage;
    const startDate = prevLessonDate
      ? addDays(prevLessonDate, 1)
      : earliestPracticeDate ?? date;
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
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .not("date", "is", null)
    .not("completed_at", "is", null)
    .lt("date", lastDate);

  return {
    items,
    nextCursor: (moreCount ?? 0) > 0 ? lastDate : null,
  };
}

async function fetchLessonEntries(
  lessonId: string
): Promise<LessonEntryWithPiece[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_entries")
    .select("*, pieces(name, composer)")
    .eq("lesson_id", lessonId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => {
    const piece = row.pieces as unknown as {
      name: string;
      composer: string | null;
    } | null;
    return {
      id: row.id,
      lesson_id: row.lesson_id,
      piece_id: row.piece_id,
      date: row.date,
      notes: row.notes,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
      piece_name: piece?.name ?? null,
      piece_composer: piece?.composer ?? null,
    };
  });
}

async function findPreviousLessonDate(
  lessonId: string,
  date: string | null
): Promise<string | null> {
  const supabase = await createClient();
  if (date) {
    const { data } = await supabase
      .from("lessons")
      .select("date")
      .not("date", "is", null)
      .not("completed_at", "is", null)
      .lt("date", date)
      .order("date", { ascending: false })
      .limit(1);
    return data?.[0]?.date ?? null;
  }

  const { data } = await supabase
    .from("lessons")
    .select("date")
    .not("date", "is", null)
    .not("completed_at", "is", null)
    .neq("id", lessonId)
    .order("date", { ascending: false })
    .limit(1);
  return data?.[0]?.date ?? null;
}

async function ensureUpcomingLesson(): Promise<string> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("lessons")
    .select("id")
    .is("completed_at", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error } = await supabase
    .from("lessons")
    .insert({ date: null, completed_at: null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created!.id;
}

export async function getLesson(
  idOrAlias: string
): Promise<{
  lesson: LessonWithEntries;
  neighbors: { prevId: string | null; nextId: string | null };
  index: LessonIndexEntry[];
}> {
  const supabase = await createClient();

  const lessonId =
    idOrAlias === "upcoming" ? await ensureUpcomingLesson() : idOrAlias;

  const { data: lessonRow, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .single();
  if (error || !lessonRow) throw new Error(error?.message ?? "Lesson not found");

  let entries = await fetchLessonEntries(lessonId);
  if (!lessonRow.completed_at && !entries.some((e) => e.piece_id === null)) {
    await supabase.from("lesson_entries").insert({
      lesson_id: lessonId,
      piece_id: null,
      date: null,
      notes: "",
      sort_order: 0,
    });
    entries = await fetchLessonEntries(lessonId);
  }

  const previousLessonDate = await findPreviousLessonDate(
    lessonId,
    lessonRow.date
  );

  const tz = await getUserTimezone();
  const today = localDate(new Date(), tz);
  const rangeEnd = lessonRow.date ?? today;
  const earliestPracticeDate = await getEarliestPracticeDate();
  const rangeStart = previousLessonDate
    ? addDays(previousLessonDate, 1)
    : earliestPracticeDate ?? rangeEnd;
  const effectiveStart = rangeStart > rangeEnd ? rangeEnd : rangeStart;
  const timeSummary = await getTimeSummaryForDateRange(effectiveStart, rangeEnd);

  const { data: allRows } = await supabase
    .from("lessons")
    .select("id, date, completed_at")
    .order("completed_at", { ascending: true, nullsFirst: false })
    .order("date", { ascending: true, nullsFirst: false });

  const sorted: LessonIndexEntry[] = (allRows ?? []).slice().sort((a, b) => {
    const aKey = a.completed_at ?? a.date ?? "9999-12-31";
    const bKey = b.completed_at ?? b.date ?? "9999-12-31";
    return aKey.localeCompare(bKey);
  });

  const currentIdx = sorted.findIndex((l) => l.id === lessonId);
  const prevId = currentIdx > 0 ? sorted[currentIdx - 1].id : null;
  const nextId =
    currentIdx >= 0 && currentIdx < sorted.length - 1
      ? sorted[currentIdx + 1].id
      : null;

  return {
    lesson: {
      id: lessonRow.id,
      date: lessonRow.date,
      completed_at: lessonRow.completed_at,
      created_at: lessonRow.created_at,
      updated_at: lessonRow.updated_at,
      entries,
      timeSummary,
      previousLessonDate,
    },
    neighbors: { prevId, nextId },
    index: sorted,
  };
}

export async function completeLesson(
  lessonId: string,
  completedDate: string
): Promise<string> {
  const supabase = await createClient();

  const { error: updateErr } = await supabase
    .from("lessons")
    .update({
      date: completedDate,
      completed_at: new Date().toISOString(),
    })
    .eq("id", lessonId);
  if (updateErr) throw new Error(updateErr.message);

  await supabase
    .from("lesson_entries")
    .update({ date: completedDate })
    .eq("lesson_id", lessonId);

  const { data: newLesson, error: insertErr } = await supabase
    .from("lessons")
    .insert({ date: null, completed_at: null })
    .select("id")
    .single();
  if (insertErr) throw new Error(insertErr.message);

  revalidatePath("/practice/lessons", "layout");
  return newLesson!.id;
}

export async function reopenLesson(lessonId: string): Promise<void> {
  const supabase = await createClient();

  const { data: existingUpcoming } = await supabase
    .from("lessons")
    .select("id")
    .is("completed_at", null);

  for (const row of existingUpcoming ?? []) {
    if (row.id === lessonId) continue;
    const { data: rowEntries } = await supabase
      .from("lesson_entries")
      .select("piece_id, notes")
      .eq("lesson_id", row.id);
    const isEmpty =
      (rowEntries ?? []).every(
        (e) => e.piece_id === null && !(e.notes ?? "").trim()
      );
    if (isEmpty) {
      await supabase.from("lessons").delete().eq("id", row.id);
    }
  }

  const { error } = await supabase
    .from("lessons")
    .update({ date: null, completed_at: null })
    .eq("id", lessonId);
  if (error) throw new Error(error.message);

  await supabase
    .from("lesson_entries")
    .update({ date: null })
    .eq("lesson_id", lessonId);

  revalidatePath("/practice/lessons", "layout");
}

export async function addPieceToLesson(
  lessonId: string,
  pieceId: string | null
): Promise<void> {
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("date")
    .eq("id", lessonId)
    .single();

  const { data: existing } = await supabase
    .from("lesson_entries")
    .select("sort_order")
    .eq("lesson_id", lessonId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSortOrder = ((existing?.[0]?.sort_order as number) ?? 0) + 1;

  const { error } = await supabase.from("lesson_entries").insert({
    lesson_id: lessonId,
    piece_id: pieceId,
    date: lesson?.date ?? null,
    notes: "",
    sort_order: nextSortOrder,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/practice/lessons", "layout");
}

export async function reorderLessonSections(
  lessonId: string,
  orderedEntryIds: string[]
): Promise<void> {
  const supabase = await createClient();
  await Promise.all(
    orderedEntryIds.map((id, index) =>
      supabase
        .from("lesson_entries")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("lesson_id", lessonId)
    )
  );
  revalidatePath("/practice/lessons", "layout");
}

export async function addLessonEntryForPiece(
  pieceId: string,
  date: string
): Promise<void> {
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("date", date)
    .not("completed_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (!lesson) return;
  await addPieceToLesson(lesson.id, pieceId);
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
  revalidatePath("/practice/lessons", "layout");
}

export async function deleteLessonEntry(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/practice/lessons", "layout");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function addNoteToUpcomingLesson(
  pieceId: string,
  noteText: string
): Promise<void> {
  const trimmed = noteText.trim();
  if (!trimmed) return;

  const supabase = await createClient();

  const { data: upcomingRows } = await supabase
    .from("lessons")
    .select("id")
    .is("completed_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  let upcomingId: string;
  if (upcomingRows && upcomingRows.length > 0) {
    upcomingId = upcomingRows[0].id;
  } else {
    const { data: created, error: insertErr } = await supabase
      .from("lessons")
      .insert({ date: null, completed_at: null })
      .select("id")
      .single();
    if (insertErr || !created) throw new Error(insertErr?.message ?? "Failed to create upcoming lesson");
    upcomingId = created.id;
  }

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const { data: existing } = await supabase
    .from("lesson_entries")
    .select("id, notes")
    .eq("lesson_id", upcomingId)
    .eq("piece_id", pieceId)
    .maybeSingle();

  if (existing) {
    const currentNotes = (existing.notes as string | null) ?? "";
    const newNotes = currentNotes + paragraphs;
    const { error } = await supabase
      .from("lesson_entries")
      .update({ notes: newNotes })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { data: rows } = await supabase
      .from("lesson_entries")
      .select("sort_order")
      .eq("lesson_id", upcomingId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextSort = ((rows?.[0]?.sort_order as number) ?? 0) + 1;

    const { error } = await supabase.from("lesson_entries").insert({
      lesson_id: upcomingId,
      piece_id: pieceId,
      date: null,
      notes: paragraphs,
      sort_order: nextSort,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/practice/lessons", "layout");
}
