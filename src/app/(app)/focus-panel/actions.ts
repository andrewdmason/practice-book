"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  Task,
  Goal,
  MentionWithSource,
  RepertoireOverviewItem,
  MasteryLevel,
} from "@/lib/types";

export async function getPieceFocusData(pieceId: string): Promise<{
  tasks: Task[];
  goals: Goal[];
  mentions: MentionWithSource[];
}> {
  const supabase = await createClient();

  // Fetch open tasks for this piece
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("piece_id", pieceId)
    .eq("completed", false)
    .order("created_at", { ascending: false });

  // Fetch open goals for this piece
  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("piece_id", pieceId)
    .eq("completed", false)
    .order("created_at", { ascending: false });

  // Fetch recent mentions for this piece
  const { data: rawMentions } = await supabase
    .from("mentions")
    .select("*")
    .eq("piece_id", pieceId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Resolve source dates for mentions
  const mentions: MentionWithSource[] = [];
  if (rawMentions && rawMentions.length > 0) {
    const lessonIds = rawMentions
      .filter((m) => m.source_type === "lesson")
      .map((m) => m.source_id);
    const practiceEntryIds = rawMentions
      .filter((m) => m.source_type === "practice_entry")
      .map((m) => m.source_id);

    let lessonDates: Record<string, string> = {};
    let practiceDates: Record<string, string> = {};

    if (lessonIds.length > 0) {
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, date")
        .in("id", lessonIds);
      if (lessons) {
        lessonDates = Object.fromEntries(lessons.map((l) => [l.id, l.date]));
      }
    }

    if (practiceEntryIds.length > 0) {
      // practice_entry source_id references practice_entry_sections
      const { data: sections } = await supabase
        .from("practice_entry_sections")
        .select("id, practice_entries(date)")
        .in("id", practiceEntryIds);
      if (sections) {
        for (const s of sections) {
          const entry = s.practice_entries as unknown as { date: string } | null;
          if (entry) {
            practiceDates[s.id] = entry.date;
          }
        }
      }
    }

    for (const m of rawMentions) {
      const isLesson = m.source_type === "lesson";
      const date = isLesson
        ? lessonDates[m.source_id]
        : practiceDates[m.source_id];
      mentions.push({
        ...m,
        source_date: date ?? m.created_at.slice(0, 10),
        source_label: isLesson ? "Lesson" : "Practice",
      });
    }
  }

  return {
    tasks: (tasks ?? []) as Task[],
    goals: (goals ?? []) as Goal[],
    mentions,
  };
}

export async function toggleTaskCompleted(taskId: string, completed: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ completed, updated_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function toggleGoalCompleted(goalId: string, completed: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("goals")
    .update({ completed, updated_at: new Date().toISOString() })
    .eq("id", goalId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function getRepertoireOverview(): Promise<RepertoireOverviewItem[]> {
  const supabase = await createClient();

  // Get all active pieces
  const { data: pieces } = await supabase
    .from("pieces")
    .select("id, name, composer, mastery_level")
    .eq("status", "active")
    .order("name");

  if (!pieces || pieces.length === 0) {
    return [];
  }

  const pieceIds = pieces.map((p) => p.id);

  // Get open task counts per piece
  const { data: taskRows } = await supabase
    .from("tasks")
    .select("piece_id")
    .in("piece_id", pieceIds)
    .eq("completed", false);

  const taskCounts = new Map<string, number>();
  if (taskRows) {
    for (const t of taskRows) {
      if (t.piece_id) {
        taskCounts.set(t.piece_id, (taskCounts.get(t.piece_id) ?? 0) + 1);
      }
    }
  }

  // Get open goal counts per piece
  const { data: goalRows } = await supabase
    .from("goals")
    .select("piece_id")
    .in("piece_id", pieceIds)
    .eq("completed", false);

  const goalCounts = new Map<string, number>();
  if (goalRows) {
    for (const g of goalRows) {
      if (g.piece_id) {
        goalCounts.set(g.piece_id, (goalCounts.get(g.piece_id) ?? 0) + 1);
      }
    }
  }

  // Get last played dates
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
    id: p.id,
    name: p.name,
    composer: p.composer,
    mastery_level: p.mastery_level as MasteryLevel,
    last_played: lastPlayedMap.get(p.id) ?? null,
    open_tasks: taskCounts.get(p.id) ?? 0,
    open_goals: goalCounts.get(p.id) ?? 0,
  }));
}
