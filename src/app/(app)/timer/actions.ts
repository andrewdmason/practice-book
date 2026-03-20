"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/date-utils";
import type { TimerTarget, TimerCategory, TimeSummaryEntry, PieceWithLastPlayed } from "@/lib/types";

export async function startSession(target: TimerTarget) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const today = localDate();

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
      piece_id: target.category === "piece" ? target.pieceId : null,
      category: target.category as TimerCategory,
      started_at: now,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    return { error: entryError?.message ?? "Failed to create timer entry" };
  }

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
      piece_id: newTarget.category === "piece" ? newTarget.pieceId : null,
      category: newTarget.category as TimerCategory,
      started_at: now,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    return { error: entryError?.message ?? "Failed to create timer entry" };
  }

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
  const today = localDate();

  const { data: sessions } = await supabase
    .from("practice_sessions")
    .select("id")
    .eq("date", today);

  if (!sessions || sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((s) => s.id);

  const { data: entries } = await supabase
    .from("timer_entries")
    .select("piece_id, category, started_at, ended_at")
    .in("session_id", sessionIds);

  if (!entries || entries.length === 0) {
    return [];
  }

  // Get piece names for entries with piece_id
  const pieceIds = [...new Set(entries.filter((e) => e.piece_id).map((e) => e.piece_id!))];
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
        piece_name: entry.piece_id ? (pieceNames[entry.piece_id] ?? null) : null,
        total_seconds: seconds,
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
      if (entry.piece_id && !lastPlayedMap.has(entry.piece_id)) {
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
