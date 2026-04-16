"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localDate, getUserTimezone } from "@/lib/date-utils";
import type { TimerTarget, TimeSummaryEntry, PieceWithLastPlayed, PieceKind } from "@/lib/types";
import { SYSTEM_PIECE_IDS } from "@/lib/types";
import { ensureTodayEntry } from "@/app/(app)/feed/actions";

/**
 * Ensure a piece section exists in today's practice entry for the given piece.
 * Called when the timer starts/switches to a piece so the feed can render it.
 */
async function ensurePieceSection(pieceId: string) {
  const supabase = await createClient();
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

export async function startSession(target: TimerTarget) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const tz = await getUserTimezone();
  const today = localDate(new Date(), tz);

  const { data: session, error: sessionError } = await supabase
    .from("practice_sessions")
    .insert({ date: today, started_at: now })
    .select("id")
    .single();

  if (sessionError || !session) {
    return { error: sessionError?.message ?? "Failed to create session" };
  }

  const { data: entry, error: entryError } = await supabase
    .from("timer_entries")
    .insert({
      session_id: session.id,
      piece_id: target.pieceId,
      section_id: target.sectionId ?? null,
      started_at: now,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    return { error: entryError?.message ?? "Failed to create timer entry" };
  }

  await ensurePieceSection(target.pieceId);

  return { sessionId: session.id, entryId: entry.id, startedAt: now };
}

export async function switchEntry(
  sessionId: string,
  currentEntryId: string,
  newTarget: TimerTarget
) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error: endError } = await supabase
    .from("timer_entries")
    .update({ ended_at: now })
    .eq("id", currentEntryId);

  if (endError) {
    return { error: endError.message };
  }

  const { data: entry, error: entryError } = await supabase
    .from("timer_entries")
    .insert({
      session_id: sessionId,
      piece_id: newTarget.pieceId,
      section_id: newTarget.sectionId ?? null,
      started_at: now,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    return { error: entryError?.message ?? "Failed to create timer entry" };
  }

  await ensurePieceSection(newTarget.pieceId);

  return { entryId: entry.id, switchedAt: now };
}

export async function stopSession(sessionId: string, currentEntryId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error: entryError } = await supabase
    .from("timer_entries")
    .update({ ended_at: now })
    .eq("id", currentEntryId);

  if (entryError) {
    return { error: entryError.message };
  }

  const { error: sessionError } = await supabase
    .from("practice_sessions")
    .update({ ended_at: now })
    .eq("id", sessionId);

  if (sessionError) {
    return { error: sessionError.message };
  }

  revalidatePath("/");
  revalidatePath("/repertoire");
  return { success: true };
}

export async function verifySession(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("practice_sessions")
    .select("ended_at, started_at")
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    return { active: false };
  }

  return { active: data.ended_at === null, startedAt: data.started_at };
}

export async function getTodaySummary(): Promise<TimeSummaryEntry[]> {
  const supabase = await createClient();
  const tz = await getUserTimezone();
  const today = localDate(new Date(), tz);

  // Fetch sessions and practice tasks in parallel
  const [sessionsResult, tasksResult] = await Promise.all([
    supabase.from("practice_sessions").select("id").eq("date", today),
    supabase
      .from("practice_tasks")
      .select("piece_id, timer_seconds, timer_remaining_seconds")
      .eq("date", today),
  ]);

  const sessions = sessionsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const sessionIds = sessions.map((s) => s.id);

  const { data: entries } = sessionIds.length > 0
    ? await supabase
        .from("timer_entries")
        .select("piece_id, started_at, ended_at")
        .in("session_id", sessionIds)
    : { data: [] as { piece_id: string; started_at: string; ended_at: string | null }[] };

  if ((!entries || entries.length === 0) && tasks.length === 0) {
    return [];
  }

  // Get piece info for all pieces referenced
  const allPieceIds = new Set<string>();
  for (const e of entries ?? []) { allPieceIds.add(e.piece_id); }
  for (const t of tasks) { allPieceIds.add(t.piece_id); }

  let pieceInfo: Record<string, { name: string; kind: PieceKind }> = {};
  if (allPieceIds.size > 0) {
    const { data: pieces } = await supabase
      .from("pieces")
      .select("id, name, kind")
      .in("id", [...allPieceIds]);
    if (pieces) {
      pieceInfo = Object.fromEntries(pieces.map((p) => [p.id, { name: p.name, kind: p.kind as PieceKind }]));
    }
  }

  // Group and sum durations from timer entries
  const groups = new Map<string, TimeSummaryEntry>();
  const now = Date.now();

  for (const entry of entries ?? []) {
    const key = entry.piece_id;
    const start = new Date(entry.started_at).getTime();
    const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now;
    const seconds = Math.floor((end - start) / 1000);

    const existing = groups.get(key);
    if (existing) {
      existing.total_seconds += seconds;
    } else {
      const info = pieceInfo[entry.piece_id];
      groups.set(key, {
        piece_id: entry.piece_id,
        piece_name: info?.name ?? "Unknown",
        kind: info?.kind ?? "piece",
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
      const info = pieceInfo[task.piece_id];
      groups.set(key, {
        piece_id: task.piece_id,
        piece_name: info?.name ?? "Unknown",
        kind: info?.kind ?? "piece",
        total_seconds: elapsed,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.total_seconds - a.total_seconds);
}

export async function getPiecesWithLastPlayed(): Promise<PieceWithLastPlayed[]> {
  const supabase = await createClient();

  const { data: pieces } = await supabase
    .from("pieces")
    .select("*")
    .eq("status", "active")
    .not("id", "in", `(${SYSTEM_PIECE_IDS.join(",")})`)
    .order("name");

  if (!pieces || pieces.length === 0) {
    return [];
  }

  const pieceIds = pieces.map((p) => p.id);

  // Get latest timer entry per piece
  const { data: entries } = await supabase
    .from("timer_entries")
    .select("piece_id, started_at")
    .in("piece_id", pieceIds)
    .order("started_at", { ascending: false });

  const lastPlayedMap = new Map<string, string>();
  if (entries) {
    for (const entry of entries) {
      if (!lastPlayedMap.has(entry.piece_id)) {
        lastPlayedMap.set(entry.piece_id, entry.started_at);
      }
    }
  }

  return pieces.map((p) => ({
    ...p,
    last_played: lastPlayedMap.get(p.id) ?? null,
  })) as PieceWithLastPlayed[];
}

export async function closeAbandonedSession(sessionId: string) {
  const supabase = await createClient();

  // Close any open timer entries for this session
  await supabase
    .from("timer_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .is("ended_at", null);

  // Close the session itself
  await supabase
    .from("practice_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId);
}
