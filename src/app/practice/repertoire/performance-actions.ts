"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Performance } from "@/lib/types";

type Owner = { pieceId: string } | { workId: string };

function revalidate(owner: { pieceId?: string | null; workId?: string | null }) {
  revalidatePath("/practice");
  revalidatePath("/practice/repertoire");
  if (owner.pieceId) {
    revalidatePath(`/practice/repertoire/${owner.pieceId}`);
  }
  if (owner.workId) {
    revalidatePath(`/practice/repertoire/works/${owner.workId}`);
  }
}

export async function getPerformances(owner: Owner): Promise<Performance[]> {
  const supabase = await createClient();

  let query = supabase.from("performances").select("*");
  query =
    "pieceId" in owner
      ? query.eq("piece_id", owner.pieceId)
      : query.eq("work_id", owner.workId);

  // Newest first: the first row is the one featured at the top.
  const { data } = await query
    .order("performed_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (data ?? []) as Performance[];
}

export async function createPerformance(input: {
  owner: Owner;
  youtubeVideoId: string;
  title?: string | null;
  performers?: string | null;
  location?: string | null;
  performedOn?: string | null;
}) {
  const supabase = await createClient();

  const ownerColumns =
    "pieceId" in input.owner
      ? { piece_id: input.owner.pieceId, work_id: null }
      : { piece_id: null, work_id: input.owner.workId };

  const { error } = await supabase.from("performances").insert({
    ...ownerColumns,
    youtube_video_id: input.youtubeVideoId,
    title: input.title?.trim() || null,
    performers: input.performers?.trim() || null,
    location: input.location?.trim() || null,
    performed_on: input.performedOn || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidate({
    pieceId: "pieceId" in input.owner ? input.owner.pieceId : null,
    workId: "workId" in input.owner ? input.owner.workId : null,
  });
  return { success: true };
}

export async function updatePerformance(
  id: string,
  fields: {
    youtubeVideoId?: string;
    title?: string | null;
    performers?: string | null;
    location?: string | null;
    performedOn?: string | null;
  }
) {
  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  if (fields.youtubeVideoId !== undefined)
    patch.youtube_video_id = fields.youtubeVideoId;
  if (fields.title !== undefined) patch.title = fields.title?.trim() || null;
  if (fields.performers !== undefined)
    patch.performers = fields.performers?.trim() || null;
  if (fields.location !== undefined)
    patch.location = fields.location?.trim() || null;
  if (fields.performedOn !== undefined)
    patch.performed_on = fields.performedOn || null;

  const { data, error } = await supabase
    .from("performances")
    .update(patch)
    .eq("id", id)
    .select("piece_id, work_id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidate({ pieceId: data.piece_id, workId: data.work_id });
  return { success: true };
}

export async function deletePerformance(id: string) {
  const supabase = await createClient();

  const { data: performance } = await supabase
    .from("performances")
    .select("piece_id, work_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("performances").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidate({
    pieceId: performance?.piece_id ?? null,
    workId: performance?.work_id ?? null,
  });
  return { success: true };
}
