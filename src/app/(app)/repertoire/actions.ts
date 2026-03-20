"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  PieceStatus,
  MasteryLevel,
  Task,
  Mention,
  MentionPage,
  MentionWithSource,
  Collection,
  Piece,
} from "@/lib/types";

function revalidateRepertoire(pieceId?: string) {
  revalidatePath("/repertoire");
  if (pieceId) {
    revalidatePath(`/repertoire/${pieceId}`);
  }
}

// --- Pieces ---

export async function createPiece(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const composer = (formData.get("composer") as string) ?? "";
  const collectionId = (formData.get("collection_id") as string) || null;
  const status = (formData.get("status") as PieceStatus) || "active";
  const masteryLevel =
    (formData.get("mastery_level") as MasteryLevel) || "learning";
  const notes = (formData.get("notes") as string) || null;

  if (!name) {
    return { error: "Name is required" };
  }

  // New pieces go to end of sort order
  const { data: maxRow } = await supabase
    .from("pieces")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data: newPiece, error } = await supabase.from("pieces").insert({
    name,
    composer,
    collection_id: collectionId,
    status,
    mastery_level: masteryLevel,
    notes,
    sort_order: nextOrder,
  }).select("id").single();

  if (error) {
    return { error: error.message };
  }

  revalidateRepertoire();
  return { success: true, pieceId: newPiece.id };
}

export async function updatePiece(id: string, formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const composer = (formData.get("composer") as string) ?? "";
  const collectionId = (formData.get("collection_id") as string) || null;
  const status = (formData.get("status") as PieceStatus) || "active";
  const masteryLevel =
    (formData.get("mastery_level") as MasteryLevel) || "learning";
  const notes = (formData.get("notes") as string) || null;

  if (!name) {
    return { error: "Name is required" };
  }

  const { error } = await supabase
    .from("pieces")
    .update({
      name,
      composer: composer.trim(),
      collection_id: collectionId,
      status,
      mastery_level: masteryLevel,
      notes,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateRepertoire(id);
  return { success: true };
}

export async function deletePiece(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("pieces").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateRepertoire();
  return { success: true };
}

export async function updatePieceStatus(
  id: string,
  status: PieceStatus,
  masteryLevel?: MasteryLevel
) {
  const supabase = await createClient();

  const update: Record<string, unknown> = { status };
  if (masteryLevel) {
    update.mastery_level = masteryLevel;
  }

  const { error } = await supabase.from("pieces").update(update).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateRepertoire(id);
  return { success: true };
}

export async function updatePieceMastery(id: string, masteryLevel: MasteryLevel) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("pieces")
    .update({ mastery_level: masteryLevel })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateRepertoire(id);
  return { success: true };
}

export async function updatePieceField(
  id: string,
  field: "name" | "composer" | "collection_id",
  value: string | null
) {
  if (field === "name" && (!value || !value.trim())) {
    return { error: "Name is required" };
  }

  const supabase = await createClient();

  const dbValue =
    field === "name" ? value!.trim()
    : field === "composer" ? (value?.trim() ?? "")
    : (value?.trim() || null);

  const update: Record<string, string | null> = {
    [field]: dbValue,
  };

  const { error } = await supabase
    .from("pieces")
    .update(update)
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateRepertoire(id);
  return { success: true };
}

export async function updatePieceNotes(id: string, notes: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("pieces")
    .update({ notes: notes || null })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateRepertoire(id);
  return { success: true };
}

export async function updatePieceDetails(
  id: string,
  data: { name: string; composer: string | null; notes: string | null }
) {
  const supabase = await createClient();

  if (!data.name.trim()) {
    return { error: "Name is required" };
  }

  const { error } = await supabase
    .from("pieces")
    .update({
      name: data.name.trim(),
      composer: data.composer?.trim() || null,
      notes: data.notes?.trim() || null,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateRepertoire(id);
  return { success: true };
}

export async function reorderPieces(orderedIds: string[]) {
  const supabase = await createClient();

  const updates = orderedIds.map((id, index) =>
    supabase.from("pieces").update({ sort_order: index }).eq("id", id)
  );

  const results = await Promise.all(updates);
  const error = results.find((r) => r.error)?.error;

  if (error) {
    return { error: error.message };
  }

  revalidateRepertoire();
  return { success: true };
}

// --- Collections ---

export async function createCollection(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const composer = (formData.get("composer") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!name) {
    return { error: "Name is required" };
  }

  const { error } = await supabase.from("collections").insert({
    name,
    composer,
    notes,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateRepertoire();
  return { success: true };
}

export async function updateCollection(id: string, formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const composer = (formData.get("composer") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!name) {
    return { error: "Name is required" };
  }

  const { error } = await supabase
    .from("collections")
    .update({ name, composer, notes })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateRepertoire();
  return { success: true };
}

export async function deleteCollection(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("collections").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateRepertoire();
  return { success: true };
}

// --- Collection detail ---

export async function getCollectionFocusData(
  collectionId: string
): Promise<{ tasks: Task[] }> {
  const supabase = await createClient();

  const { data: pieces } = await supabase
    .from("pieces")
    .select("id")
    .eq("collection_id", collectionId);

  const pieceIds = (pieces ?? []).map((p) => p.id);
  if (pieceIds.length === 0) {
    return { tasks: [] };
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .in("piece_id", pieceIds)
    .eq("completed", false)
    .order("created_at", { ascending: false });

  return {
    tasks: (tasks ?? []) as Task[],
  };
}

export async function getCollectionMentions(
  collectionId: string,
  cursor?: string,
  limit = 20
): Promise<MentionPage> {
  const supabase = await createClient();

  const { data: pieces } = await supabase
    .from("pieces")
    .select("id")
    .eq("collection_id", collectionId);

  const pieceIds = (pieces ?? []).map((p) => p.id);
  if (pieceIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  let query = supabase
    .from("mentions")
    .select("*")
    .in("piece_id", pieceIds)
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

async function resolveMentionSources(
  rawMentions: Mention[]
): Promise<MentionWithSource[]> {
  if (rawMentions.length === 0) return [];

  const supabase = await createClient();

  const sectionIds = rawMentions.map((m) => m.source_id);

  const sectionDates: Record<string, { date: string; type: string }> = {};

  if (sectionIds.length > 0) {
    const { data: sections } = await supabase
      .from("practice_entry_sections")
      .select("id, practice_entries(date, type)")
      .in("id", sectionIds);
    if (sections) {
      for (const s of sections) {
        const entry = s.practice_entries as unknown as { date: string; type: string } | null;
        if (entry) {
          sectionDates[s.id] = { date: entry.date, type: entry.type };
        }
      }
    }
  }

  return rawMentions.map((m) => {
    const info = sectionDates[m.source_id];
    return {
      ...m,
      source_date: info?.date ?? m.created_at.slice(0, 10),
      source_label: info?.type === "lesson" ? "Lesson" : "Practice",
    };
  });
}
