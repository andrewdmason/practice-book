"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "task-audio";

export async function createAudioUploadUrl(
  taskId: string,
  ext: "webm" | "m4a"
): Promise<{ path: string; token: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const path = `${user.id}/${taskId}.${ext}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create signed upload URL");
  }
  return { path: data.path, token: data.token };
}

export async function attachTaskAudio(
  taskId: string,
  audioPath: string,
  durationSeconds: number,
  trimStartSeconds: number | null,
  trimEndSeconds: number | null
): Promise<void> {
  const supabase = await createClient();

  // If re-recording moved the file to a different path (ext change, etc.),
  // remove the previous object so it doesn't orphan in the bucket.
  const { data: prev } = await supabase
    .from("practice_tasks")
    .select("audio_path")
    .eq("id", taskId)
    .single();
  if (prev?.audio_path && prev.audio_path !== audioPath) {
    await supabase.storage.from(BUCKET).remove([prev.audio_path]);
  }

  const { error } = await supabase
    .from("practice_tasks")
    .update({
      audio_path: audioPath,
      audio_duration_seconds: Math.max(0, Math.round(durationSeconds)),
      audio_trim_start_seconds: trimStartSeconds,
      audio_trim_end_seconds: trimEndSeconds,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function updateTaskAudioTrim(
  taskId: string,
  trimStartSeconds: number | null,
  trimEndSeconds: number | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("practice_tasks")
    .update({
      audio_trim_start_seconds: trimStartSeconds,
      audio_trim_end_seconds: trimEndSeconds,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/recordings");
}

export async function createSignedPlaybackUrl(
  audioPath: string
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(audioPath, 60 * 60);
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create signed playback URL");
  }
  return data.signedUrl;
}

export async function deleteTaskAudio(taskId: string): Promise<void> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("practice_tasks")
    .select("audio_path")
    .eq("id", taskId)
    .single();

  if (row?.audio_path) {
    await supabase.storage.from(BUCKET).remove([row.audio_path]);
  }

  const { error } = await supabase
    .from("practice_tasks")
    .update({
      audio_path: null,
      audio_duration_seconds: null,
      audio_trim_start_seconds: null,
      audio_trim_end_seconds: null,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
