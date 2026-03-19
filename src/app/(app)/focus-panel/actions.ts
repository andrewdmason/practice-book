"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  Task,
  Mention,
  MentionWithSource,
  MentionPage,
  RepertoireOverviewItem,
  MasteryLevel,
} from "@/lib/types";

export async function getPieceFocusData(pieceId: string): Promise<{
  tasks: Task[];
  mentions: MentionWithSource[];
}> {
  const supabase = await createClient();

  // Fetch open tasks for this piece (includes both default and goal-style)
  const { data: tasks } = await supabase
    .from("tasks")
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

  const mentions = await resolveMentionSources(rawMentions ?? []);

  return {
    tasks: (tasks ?? []) as Task[],
    mentions,
  };
}

async function resolveMentionSources(
  rawMentions: Mention[]
): Promise<MentionWithSource[]> {
  if (rawMentions.length === 0) return [];

  const supabase = await createClient();

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

  return rawMentions.map((m) => {
    const isLesson = m.source_type === "lesson";
    const date = isLesson
      ? lessonDates[m.source_id]
      : practiceDates[m.source_id];
    return {
      ...m,
      source_date: date ?? m.created_at.slice(0, 10),
      source_label: isLesson ? "Lesson" : "Practice",
    };
  });
}

export async function getPieceMentions(
  pieceId: string,
  cursor?: string,
  limit = 20
): Promise<MentionPage> {
  const supabase = await createClient();

  let query = supabase
    .from("mentions")
    .select("*")
    .eq("piece_id", pieceId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: rawMentions } = await query;
  const rows = rawMentions ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = await resolveMentionSources(page as Mention[]);

  return {
    items,
    nextCursor: hasMore ? page[page.length - 1].created_at : null,
  };
}

export async function toggleTaskCompleted(taskId: string, completed: boolean) {
  const supabase = await createClient();

  // 1. Update the tasks table
  const { data: task, error } = await supabase
    .from("tasks")
    .update({ completed, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select("source_type, source_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // 2. Sync the checked state back into the editor JSON content
  if (task?.source_type === "practice_entry") {
    const { data: section } = await supabase
      .from("practice_entry_sections")
      .select("content")
      .eq("id", task.source_id)
      .single();

    if (section?.content) {
      const updated = updateTaskChecked(section.content, taskId, completed);
      if (updated) {
        await supabase
          .from("practice_entry_sections")
          .update({ content: updated })
          .eq("id", task.source_id);
      }
    }
  } else if (task?.source_type === "lesson") {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("content")
      .eq("id", task.source_id)
      .single();

    if (lesson?.content) {
      const updated = updateTaskChecked(lesson.content, taskId, completed);
      if (updated) {
        await supabase
          .from("lessons")
          .update({ content: updated })
          .eq("id", task.source_id);
      }
    }
  }

  revalidatePath("/");
}

// Walk TipTap JSON and update the checked/completed attribute for a task or goal block
function updateTaskChecked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any,
  taskId: string,
  checked: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (!node) return node;

  if (node.type === "taskItem" && node.attrs?.taskId === taskId) {
    return {
      ...node,
      attrs: { ...node.attrs, checked },
    };
  }

  if (node.type === "goalBlock" && node.attrs?.goalId === taskId) {
    return {
      ...node,
      attrs: { ...node.attrs, completed: checked },
    };
  }

  if (node.content) {
    return {
      ...node,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: node.content.map((child: any) =>
        updateTaskChecked(child, taskId, checked)
      ),
    };
  }

  return node;
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

  // Get open task counts per piece (includes both default and goal-style)
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
  }));
}
