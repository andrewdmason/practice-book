"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  Assignment,
  RepertoireOverviewItem,
} from "@/lib/types";

export async function getPieceFocusData(pieceId: string): Promise<{
  openAssignments: Assignment[];
  completedAssignments: Assignment[];
}> {
  const supabase = await createClient();

  // Fetch open assignments for this piece
  const { data: openAssignments } = await supabase
    .from("assignments")
    .select("*")
    .eq("piece_id", pieceId)
    .lt("progress", 4)
    .order("created_at", { ascending: false });

  // Fetch completed assignments for this piece
  const { data: completedAssignments } = await supabase
    .from("assignments")
    .select("*")
    .eq("piece_id", pieceId)
    .eq("progress", 4)
    .order("completed_at", { ascending: false });

  return {
    openAssignments: (openAssignments ?? []) as Assignment[],
    completedAssignments: (completedAssignments ?? []) as Assignment[],
  };
}

export async function getCategoryFocusData(
  category: "technique" | "sight_reading"
): Promise<{ assignments: Assignment[] }> {
  const supabase = await createClient();

  // Find all section IDs for this category
  const { data: sections } = await supabase
    .from("practice_entry_sections")
    .select("id")
    .eq("category", category);

  if (!sections || sections.length === 0) return { assignments: [] };

  const sectionIds = sections.map((s) => s.id);

  // Fetch open assignments from those sections
  const { data: assignments } = await supabase
    .from("assignments")
    .select("*")
    .in("source_id", sectionIds)
    .lt("progress", 4)
    .order("created_at", { ascending: false });

  return { assignments: (assignments ?? []) as Assignment[] };
}

export async function updateAssignmentProgress(assignmentId: string, progress: number) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // 1. Update the assignments table
  const { data: assignment, error } = await supabase
    .from("assignments")
    .update({
      progress,
      completed_at: progress === 4 ? now : null,
      updated_at: now,
    })
    .eq("id", assignmentId)
    .select("source_type, source_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // 2. Sync the progress back into the editor JSON content
  if (assignment) {
    const { data: section } = await supabase
      .from("practice_entry_sections")
      .select("content")
      .eq("id", assignment.source_id)
      .single();

    if (section?.content) {
      const updated = updateAssignmentProgressInJson(section.content, assignmentId, progress);
      if (updated) {
        await supabase
          .from("practice_entry_sections")
          .update({ content: updated })
          .eq("id", assignment.source_id);
      }
    }
  }

  revalidatePath("/");
}

// Walk TipTap JSON and update the progress attribute for an assignment
function updateAssignmentProgressInJson(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any,
  assignmentId: string,
  progress: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (!node) return node;

  if (node.type === "taskItem" && node.attrs?.taskId === assignmentId) {
    return {
      ...node,
      attrs: { ...node.attrs, progress },
    };
  }

  if (node.content) {
    return {
      ...node,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: node.content.map((child: any) =>
        updateAssignmentProgressInJson(child, assignmentId, progress)
      ),
    };
  }

  return node;
}

export async function updateAssignmentNote(assignmentId: string, note: string | null) {
  const supabase = await createClient();

  const { data: assignment, error } = await supabase
    .from("assignments")
    .update({ note, updated_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .select("source_type, source_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Sync the note back into the editor JSON content
  if (assignment) {
    const { data: section } = await supabase
      .from("practice_entry_sections")
      .select("content")
      .eq("id", assignment.source_id)
      .single();

    if (section?.content) {
      const updated = updateAssignmentNoteInJson(section.content, assignmentId, note);
      if (updated) {
        await supabase
          .from("practice_entry_sections")
          .update({ content: updated })
          .eq("id", assignment.source_id);
      }
    }
  }

  revalidatePath("/");
}

// Walk TipTap JSON and update the note attribute for an assignment
function updateAssignmentNoteInJson(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any,
  assignmentId: string,
  note: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (!node) return node;

  if (node.type === "taskItem" && node.attrs?.taskId === assignmentId) {
    return {
      ...node,
      attrs: { ...node.attrs, note },
    };
  }

  if (node.content) {
    return {
      ...node,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: node.content.map((child: any) =>
        updateAssignmentNoteInJson(child, assignmentId, note)
      ),
    };
  }

  return node;
}

export type AssignmentWithPiece = Assignment & {
  piece_name: string | null;
  piece_composer: string | null;
  section_category: string | null;
};

export async function getAllOpenAssignments(): Promise<AssignmentWithPiece[]> {
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("assignments")
    .select("*, pieces(name, composer)")
    .lt("progress", 4)
    .order("created_at", { ascending: false });

  if (!assignments) return [];

  // For non-piece assignments, resolve section categories
  const nonPieceSectionIds = assignments
    .filter((t) => !t.piece_id)
    .map((t) => t.source_id);

  const categoryMap = new Map<string, string>();
  if (nonPieceSectionIds.length > 0) {
    const { data: sections } = await supabase
      .from("practice_entry_sections")
      .select("id, category")
      .in("id", nonPieceSectionIds);
    if (sections) {
      for (const s of sections) {
        categoryMap.set(s.id, s.category);
      }
    }
  }

  return assignments.map((t) => {
    const piece = t.pieces as unknown as { name: string; composer: string | null } | null;
    return {
      id: t.id,
      source_type: t.source_type,
      source_id: t.source_id,
      piece_id: t.piece_id,
      text: t.text,
      progress: t.progress,
      completed_at: t.completed_at,
      note: t.note,
      created_at: t.created_at,
      updated_at: t.updated_at,
      piece_name: piece?.name ?? null,
      piece_composer: piece?.composer ?? null,
      section_category: t.piece_id ? "piece" : (categoryMap.get(t.source_id) ?? null),
    } as AssignmentWithPiece;
  });
}

export async function getRepertoireOverview(): Promise<RepertoireOverviewItem[]> {
  const supabase = await createClient();

  // Get all active pieces
  const { data: pieces } = await supabase
    .from("pieces")
    .select("id, name, composer")
    .eq("status", "active")
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
    .lt("progress", 4);

  const assignmentCounts = new Map<string, number>();
  if (assignmentRows) {
    for (const t of assignmentRows) {
      if (t.piece_id) {
        assignmentCounts.set(t.piece_id, (assignmentCounts.get(t.piece_id) ?? 0) + 1);
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
    last_played: lastPlayedMap.get(p.id) ?? null,
    open_assignments: assignmentCounts.get(p.id) ?? 0,
  }));
}
