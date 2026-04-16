"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  Assignment,
  RepertoireOverviewItem,
  PieceKind,
} from "@/lib/types";
import { SYSTEM_PIECE_IDS } from "@/lib/types";

export async function getAssignmentsForPiece(pieceId: string): Promise<{
  openAssignments: Assignment[];
  completedAssignments: Assignment[];
}> {
  const supabase = await createClient();

  const [openResult, completedResult] = await Promise.all([
    supabase
      .from("assignments")
      .select("*")
      .eq("piece_id", pieceId)
      .eq("completed", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("assignments")
      .select("*")
      .eq("piece_id", pieceId)
      .eq("completed", true)
      .order("completed_at", { ascending: false }),
  ]);

  return {
    openAssignments: (openResult.data ?? []) as Assignment[],
    completedAssignments: (completedResult.data ?? []) as Assignment[],
  };
}

export async function toggleAssignmentCompleted(assignmentId: string, completed: boolean) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("assignments")
    .update({
      completed,
      completed_at: completed ? now : null,
      updated_at: now,
    })
    .eq("id", assignmentId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function createAssignment(pieceId: string, text: string): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assignments")
    .insert({ piece_id: pieceId, text })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  return data.id;
}

export async function deleteAssignment(assignmentId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function updateAssignmentText(assignmentId: string, text: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("assignments")
    .update({ text, updated_at: new Date().toISOString() })
    .eq("id", assignmentId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export type AssignmentWithPiece = Assignment & {
  piece_name: string;
  piece_composer: string | null;
  kind: PieceKind;
};

export async function getAllOpenAssignments(): Promise<AssignmentWithPiece[]> {
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("assignments")
    .select("*, pieces(name, composer, kind)")
    .eq("completed", false)
    .order("created_at", { ascending: false });

  if (!assignments) return [];

  return assignments.map((t) => {
    const piece = t.pieces as unknown as { name: string; composer: string | null; kind: PieceKind };
    return {
      id: t.id,
      piece_id: t.piece_id,
      text: t.text,
      completed: t.completed,
      completed_at: t.completed_at,
      created_at: t.created_at,
      updated_at: t.updated_at,
      piece_name: piece.name,
      piece_composer: piece.composer,
      kind: piece.kind,
    } as AssignmentWithPiece;
  });
}

export async function getRepertoireOverview(): Promise<RepertoireOverviewItem[]> {
  const supabase = await createClient();

  // Get all active pieces (excluding system pieces)
  const { data: pieces } = await supabase
    .from("pieces")
    .select("id, name, composer")
    .eq("status", "active")
    .not("id", "in", `(${SYSTEM_PIECE_IDS.join(",")})`)
    .order("name");

  if (!pieces || pieces.length === 0) {
    return [];
  }

  const pieceIds = pieces.map((p) => p.id);

  // Get open assignment counts per piece
  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("piece_id")
    .in("piece_id", pieceIds)
    .eq("completed", false);

  const assignmentCounts = new Map<string, number>();
  if (assignmentRows) {
    for (const t of assignmentRows) {
      assignmentCounts.set(t.piece_id, (assignmentCounts.get(t.piece_id) ?? 0) + 1);
    }
  }

  // Get last played dates from practice_tasks
  const { data: tasks } = await supabase
    .from("practice_tasks")
    .select("piece_id, created_at")
    .in("piece_id", pieceIds)
    .order("created_at", { ascending: false });

  const lastPlayedMap = new Map<string, string>();
  if (tasks) {
    for (const task of tasks) {
      if (!lastPlayedMap.has(task.piece_id)) {
        lastPlayedMap.set(task.piece_id, task.created_at);
      }
    }
  }

  return pieces.map((p) => ({
    id: p.id,
    name: p.name,
    composer: p.composer,
    last_played: lastPlayedMap.get(p.id) ?? null,
    open_assignments: assignmentCounts.get(p.id) ?? 0,
  }));
}
