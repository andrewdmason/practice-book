"use server";

import { createClient } from "@/lib/supabase/server";
import { localDate, getUserTimezone } from "@/lib/date-utils";
import { getTimeSummaryForDateRange } from "@/app/(app)/feed/actions";
import type { LessonTimeSummary, SectionStatus } from "@/lib/types";

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

async function resolveRange(
  lessonId: string
): Promise<{ start: string; end: string }> {
  const supabase = await createClient();
  const tz = await getUserTimezone();
  const today = localDate(new Date(), tz);

  const { data: lesson } = await supabase
    .from("lessons")
    .select("date, completed_at")
    .eq("id", lessonId)
    .single();

  const end = lesson?.date ?? today;

  let prevQuery = supabase
    .from("lessons")
    .select("date")
    .not("date", "is", null)
    .not("completed_at", "is", null)
    .neq("id", lessonId);
  if (lesson?.date) {
    prevQuery = prevQuery.lt("date", lesson.date);
  }
  const { data: prev } = await prevQuery
    .order("date", { ascending: false })
    .limit(1);
  const prevDate: string | null = prev?.[0]?.date ?? null;

  let start: string;
  if (prevDate) {
    start = addDays(prevDate, 1);
  } else {
    const { data: earliest } = await supabase
      .from("practice_tasks")
      .select("date")
      .order("date", { ascending: true })
      .limit(1);
    start = earliest?.[0]?.date ?? end;
  }

  return { start: start > end ? end : start, end };
}

export type LessonOverviewExtras = {
  longestSessionSeconds: number;
  sectionsAdvancedCount: number;
};

export async function getLessonOverviewExtras(
  lessonId: string
): Promise<LessonOverviewExtras> {
  const supabase = await createClient();
  const { start, end } = await resolveRange(lessonId);

  const { data: tasks } = await supabase
    .from("practice_tasks")
    .select("timer_seconds, timer_remaining_seconds")
    .gte("date", start)
    .lte("date", end);

  let longest = 0;
  for (const t of tasks ?? []) {
    const elapsed = (t.timer_seconds ?? 0) - (t.timer_remaining_seconds ?? 0);
    if (elapsed > longest) longest = elapsed;
  }

  const { data: snapshots } = await supabase
    .from("section_status_snapshots")
    .select("section_id, old_status, new_status")
    .gte("snapshot_date", start)
    .lte("snapshot_date", end);

  const advanced = new Set<string>();
  for (const s of snapshots ?? []) {
    if ((s.new_status ?? 0) > (s.old_status ?? 0)) {
      advanced.add(s.section_id);
    }
  }

  return {
    longestSessionSeconds: longest,
    sectionsAdvancedCount: advanced.size,
  };
}

export type SectionDelta = {
  sectionId: string;
  label: string;
  fromStatus: SectionStatus;
  toStatus: SectionStatus;
  isNew: boolean;
};

export type PieceSparklinePoint = {
  lessonDate: string;
  totalSeconds: number;
};

export type LessonPieceStats = {
  pieceTimeSeconds: number;
  daysPracticed: number;
  calendarDays: number;
  sparkline: PieceSparklinePoint[];
  sectionDeltas: SectionDelta[];
  targetTempo: number | null;
  currentTempo: number | null;
};

export async function getLessonPieceStats(
  lessonId: string,
  pieceId: string
): Promise<LessonPieceStats> {
  const supabase = await createClient();
  const { start, end } = await resolveRange(lessonId);

  const summary: LessonTimeSummary = await getTimeSummaryForDateRange(start, end);
  const pieceEntry = summary.entries.find((e) => e.piece_id === pieceId);
  const pieceTimeSeconds = pieceEntry?.total_seconds ?? 0;

  const { data: pieceTasks } = await supabase
    .from("practice_tasks")
    .select("date, timer_seconds, timer_remaining_seconds, metronome_speed")
    .eq("piece_id", pieceId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  const daySet = new Set<string>();
  let currentTempo: number | null = null;
  for (const t of pieceTasks ?? []) {
    const elapsed = (t.timer_seconds ?? 0) - (t.timer_remaining_seconds ?? 0);
    if (elapsed > 0) daySet.add(t.date);
    if (currentTempo === null && t.metronome_speed) {
      currentTempo = t.metronome_speed as number;
    }
  }

  const { data: piece } = await supabase
    .from("pieces")
    .select("target_tempo")
    .eq("id", pieceId)
    .maybeSingle();

  const { data: snapshots } = await supabase
    .from("section_status_snapshots")
    .select("section_id, old_status, new_status, snapshot_date")
    .eq("piece_id", pieceId)
    .gte("snapshot_date", start)
    .lte("snapshot_date", end)
    .order("snapshot_date", { ascending: true });

  type DeltaAccum = {
    from: number;
    to: number;
  };
  const accum = new Map<string, DeltaAccum>();
  for (const s of snapshots ?? []) {
    const existing = accum.get(s.section_id);
    if (!existing) {
      accum.set(s.section_id, {
        from: s.old_status as number,
        to: s.new_status as number,
      });
    } else {
      if ((s.old_status as number) < existing.from) existing.from = s.old_status as number;
      if ((s.new_status as number) > existing.to) existing.to = s.new_status as number;
    }
  }

  let sectionDeltas: SectionDelta[] = [];
  if (accum.size > 0) {
    const ids = [...accum.keys()];
    const { data: sections } = await supabase
      .from("piece_sections")
      .select("id, label")
      .in("id", ids);
    const labelMap = new Map(
      (sections ?? []).map((s) => [s.id, s.label as string])
    );
    sectionDeltas = ids
      .map((sectionId) => {
        const d = accum.get(sectionId)!;
        const label = labelMap.get(sectionId) ?? "?";
        return {
          sectionId,
          label,
          fromStatus: d.from as SectionStatus,
          toStatus: d.to as SectionStatus,
          isNew: d.from === 0,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  const { data: recentLessons } = await supabase
    .from("lessons")
    .select("date")
    .not("date", "is", null)
    .not("completed_at", "is", null)
    .lte("date", end)
    .order("date", { ascending: false })
    .limit(6);

  const sparkline: PieceSparklinePoint[] = [];
  const dates = (recentLessons ?? [])
    .map((r) => r.date as string)
    .reverse();

  const { data: earliestTask } = await supabase
    .from("practice_tasks")
    .select("date")
    .order("date", { ascending: true })
    .limit(1);
  const earliestDate = earliestTask?.[0]?.date ?? null;

  for (let i = 0; i < dates.length; i++) {
    const rangeEnd = dates[i];
    const prevRangeDate =
      i > 0 ? dates[i - 1] : earliestDate ? earliestDate : rangeEnd;
    const rangeStart =
      i > 0 ? addDays(dates[i - 1], 1) : prevRangeDate;
    const effectiveStart = rangeStart > rangeEnd ? rangeEnd : rangeStart;
    const s = await getTimeSummaryForDateRange(effectiveStart, rangeEnd);
    const entry = s.entries.find((e) => e.piece_id === pieceId);
    sparkline.push({
      lessonDate: rangeEnd,
      totalSeconds: entry?.total_seconds ?? 0,
    });
  }

  return {
    pieceTimeSeconds,
    daysPracticed: daySet.size,
    calendarDays: summary.calendarDays,
    sparkline,
    sectionDeltas,
    targetTempo: (piece?.target_tempo as number | null) ?? null,
    currentTempo,
  };
}
