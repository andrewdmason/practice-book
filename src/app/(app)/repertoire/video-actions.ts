"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PieceVideo, PieceSectionTimestamp } from "@/lib/types";

function revalidate(pieceId?: string) {
  revalidatePath("/");
  revalidatePath("/repertoire");
  if (pieceId) {
    revalidatePath(`/repertoire/${pieceId}`);
  }
}

export async function getVideos(pieceId: string): Promise<PieceVideo[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("piece_videos")
    .select("*")
    .eq("piece_id", pieceId)
    .order("sort_order", { ascending: true });

  return (data ?? []) as PieceVideo[];
}

export async function createVideo(
  pieceId: string,
  youtubeVideoId: string,
  title?: string
) {
  const supabase = await createClient();

  // Get next sort_order
  const { data: maxRow } = await supabase
    .from("piece_videos")
    .select("sort_order")
    .eq("piece_id", pieceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("piece_videos")
    .insert({
      piece_id: pieceId,
      youtube_video_id: youtubeVideoId,
      title: title ?? null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidate(pieceId);
  return { success: true, video: data as PieceVideo };
}

export async function deleteVideo(videoId: string) {
  const supabase = await createClient();

  const { data: video } = await supabase
    .from("piece_videos")
    .select("piece_id")
    .eq("id", videoId)
    .single();

  const { error } = await supabase
    .from("piece_videos")
    .delete()
    .eq("id", videoId);

  if (error) {
    return { error: error.message };
  }

  revalidate(video?.piece_id);
  return { success: true };
}

export async function updateVideoTimeRange(
  videoId: string,
  startSeconds: number | null,
  endSeconds: number | null
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("piece_videos")
    .update({ start_seconds: startSeconds, end_seconds: endSeconds })
    .eq("id", videoId)
    .select("piece_id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidate(data.piece_id);
  return { success: true };
}

export async function getTimestamps(
  videoId: string
): Promise<PieceSectionTimestamp[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("piece_section_timestamps")
    .select("*")
    .eq("video_id", videoId)
    .order("start_seconds", { ascending: true });

  return (data ?? []) as PieceSectionTimestamp[];
}

export async function upsertTimestamp(
  sectionId: string,
  videoId: string,
  startSeconds: number,
  endSeconds?: number | null
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("piece_section_timestamps")
    .upsert(
      {
        section_id: sectionId,
        video_id: videoId,
        start_seconds: startSeconds,
        end_seconds: endSeconds ?? null,
      },
      { onConflict: "section_id,video_id" }
    );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function deleteTimestamp(sectionId: string, videoId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("piece_section_timestamps")
    .delete()
    .eq("section_id", sectionId)
    .eq("video_id", videoId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
