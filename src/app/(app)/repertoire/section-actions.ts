"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PieceSection, PieceSectionWithChildren, SectionStatus } from "@/lib/types";

function revalidate(pieceId?: string) {
  revalidatePath("/");
  revalidatePath("/repertoire");
  if (pieceId) {
    revalidatePath(`/repertoire/${pieceId}`);
  }
}

export async function getSections(
  pieceId: string
): Promise<PieceSectionWithChildren[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("piece_sections")
    .select("*")
    .eq("piece_id", pieceId)
    .order("sort_order", { ascending: true });

  const rows = (data ?? []) as PieceSection[];

  // Nest children under parents
  const parents = rows
    .filter((r) => r.parent_id === null)
    .map((p) => ({
      ...p,
      children: rows
        .filter((c) => c.parent_id === p.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));

  return parents;
}

export async function createSection(
  pieceId: string,
  label: string,
  parentId: string | null = null
) {
  const supabase = await createClient();

  // Get next sort_order among siblings
  let query = supabase
    .from("piece_sections")
    .select("sort_order")
    .eq("piece_id", pieceId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (parentId) {
    query = query.eq("parent_id", parentId);
  } else {
    query = query.is("parent_id", null);
  }

  const { data: maxRow } = await query.single();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("piece_sections")
    .insert({
      piece_id: pieceId,
      parent_id: parentId,
      label,
      sort_order: nextOrder,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidate(pieceId);
  return { success: true, id: data.id };
}

export async function updateSectionStatus(
  sectionId: string,
  status: SectionStatus
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("piece_sections")
    .update({ status })
    .eq("id", sectionId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function updateSectionTargetTempo(
  sectionId: string,
  targetTempo: number | null
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("piece_sections")
    .update({ target_tempo: targetTempo })
    .eq("id", sectionId)
    .select("piece_id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidate(data.piece_id);
  return { success: true };
}

export async function updateSectionLabel(sectionId: string, label: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("piece_sections")
    .update({ label })
    .eq("id", sectionId)
    .select("piece_id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidate(data.piece_id);
  return { success: true };
}

export async function deleteSection(sectionId: string) {
  const supabase = await createClient();

  // Get piece_id before deleting
  const { data: section } = await supabase
    .from("piece_sections")
    .select("piece_id")
    .eq("id", sectionId)
    .single();

  const { error } = await supabase
    .from("piece_sections")
    .delete()
    .eq("id", sectionId);

  if (error) {
    return { error: error.message };
  }

  revalidate(section?.piece_id);
  return { success: true };
}

export async function reorderSections(sectionIds: string[]) {
  const supabase = await createClient();

  const updates = sectionIds.map((id, index) =>
    supabase.from("piece_sections").update({ sort_order: index }).eq("id", id)
  );

  const results = await Promise.all(updates);
  const error = results.find((r) => r.error)?.error;

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function updatePieceTargetTempo(
  pieceId: string,
  targetTempo: number | null
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("pieces")
    .update({ target_tempo: targetTempo })
    .eq("id", pieceId);

  if (error) {
    return { error: error.message };
  }

  revalidate(pieceId);
  return { success: true };
}
