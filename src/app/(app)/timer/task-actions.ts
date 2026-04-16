"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PracticeTask, PracticeTaskType } from "@/lib/types";

export type TaskWithPiece = PracticeTask & {
  piece_name: string | null;
  piece_composer: string | null;
  section_label: string | null;
};

export async function getTasksForPieceAndDate(
  pieceId: string,
  date: string
): Promise<PracticeTask[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("practice_tasks")
    .select("*")
    .eq("piece_id", pieceId)
    .eq("date", date)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (data ?? []) as PracticeTask[];
}

export async function getTasksForPiece(pieceId: string): Promise<PracticeTask[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("practice_tasks")
    .select("*")
    .eq("piece_id", pieceId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (data ?? []) as PracticeTask[];
}

export async function getTasksForDate(date: string): Promise<TaskWithPiece[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("practice_tasks")
    .select("*, pieces(name, composer), piece_sections(label)")
    .eq("date", date)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    piece_name: row.pieces?.name ?? null,
    piece_composer: row.pieces?.composer ?? null,
    section_label: row.piece_sections?.label ?? null,
    pieces: undefined,
    piece_sections: undefined,
  }));
}

export async function createTask(
  pieceId: string | null,
  sectionId: string | null,
  metronomeSpeed: number | null,
  date?: string,
  type?: PracticeTaskType
): Promise<{ id: string }> {
  const supabase = await createClient();

  // Get next sort_order
  let sortQuery = supabase
    .from("practice_tasks")
    .select("sort_order")
    .eq("completed", false)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (pieceId) {
    sortQuery = sortQuery.eq("piece_id", pieceId);
  } else {
    sortQuery = sortQuery.is("piece_id", null);
  }

  const { data: maxRow } = await sortQuery.single();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("practice_tasks")
    .insert({
      piece_id: pieceId,
      section_id: sectionId,
      metronome_speed: metronomeSpeed,
      sort_order: nextOrder,
      type: type ?? "practice",
      ...(date ? { date } : {}),
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create task");

  return { id: data.id };
}

export async function updateTaskField(
  taskId: string,
  field: "text" | "metronome_speed" | "timer_seconds" | "timer_remaining_seconds",
  value: string | number | null
) {
  const supabase = await createClient();

  // When updating timer_seconds, also reset timer_remaining_seconds to match
  if (field === "timer_seconds") {
    await supabase
      .from("practice_tasks")
      .update({ timer_seconds: value as number, timer_remaining_seconds: value as number })
      .eq("id", taskId);
  } else {
    await supabase
      .from("practice_tasks")
      .update({ [field]: value })
      .eq("id", taskId);
  }

  revalidatePath("/");
}

export async function completeTask(taskId: string) {
  const supabase = await createClient();

  await supabase
    .from("practice_tasks")
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq("id", taskId);

  revalidatePath("/");
}

export async function uncompleteTask(taskId: string) {
  const supabase = await createClient();

  await supabase
    .from("practice_tasks")
    .update({ completed: false, completed_at: null })
    .eq("id", taskId);

  revalidatePath("/");
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();

  await supabase
    .from("practice_tasks")
    .delete()
    .eq("id", taskId);

  revalidatePath("/");
}

export async function duplicateTaskToTomorrow(
  taskId: string
): Promise<{ id: string; date: string }> {
  const supabase = await createClient();

  const { data: source } = await supabase
    .from("practice_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (!source) throw new Error("Task not found");

  // Compute tomorrow's date from the source task's date
  const srcDate = new Date(source.date + "T12:00:00");
  srcDate.setDate(srcDate.getDate() + 1);
  const tomorrowDate = srcDate.toISOString().slice(0, 10);

  // Get next sort_order for tomorrow's tasks
  let sortQuery = supabase
    .from("practice_tasks")
    .select("sort_order")
    .eq("date", tomorrowDate)
    .eq("completed", false)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (source.piece_id) {
    sortQuery = sortQuery.eq("piece_id", source.piece_id);
  } else {
    sortQuery = sortQuery.is("piece_id", null);
  }

  const { data: maxTask } = await sortQuery.single();
  const nextOrder = (maxTask?.sort_order ?? -1) + 1;

  const { data: newTask, error } = await supabase
    .from("practice_tasks")
    .insert({
      piece_id: source.piece_id,
      section_id: source.section_id,
      date: tomorrowDate,
      type: source.type,
      text: source.text,
      metronome_speed: source.metronome_speed,
      timer_seconds: source.timer_seconds,
      timer_remaining_seconds: source.timer_seconds, // Reset timer
      sort_order: nextOrder,
    })
    .select("id")
    .single();

  if (error || !newTask) throw new Error(error?.message ?? "Failed to duplicate task");

  revalidatePath("/");
  return { id: newTask.id, date: tomorrowDate };
}

export async function updateTaskRemaining(taskId: string, remainingSeconds: number) {
  const supabase = await createClient();

  await supabase
    .from("practice_tasks")
    .update({ timer_remaining_seconds: remainingSeconds })
    .eq("id", taskId);
}

export async function startTaskTimer(taskId: string) {
  const supabase = await createClient();

  await supabase
    .from("practice_tasks")
    .update({ started_at: new Date().toISOString() })
    .eq("id", taskId);
}

export async function stopTaskTimer(taskId: string) {
  const supabase = await createClient();

  await supabase
    .from("practice_tasks")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", taskId);

  revalidatePath("/");
}

export async function reorderTasks(taskIds: string[]) {
  const supabase = await createClient();

  const updates = taskIds.map((id, index) =>
    supabase
      .from("practice_tasks")
      .update({ sort_order: index })
      .eq("id", id)
  );

  await Promise.all(updates);
  revalidatePath("/");
}
