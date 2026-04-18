"use server";

import { createClient } from "@/lib/supabase/server";

export type Recording = {
  taskId: string;
  audioPath: string;
  durationSeconds: number;
  trimStartSeconds: number | null;
  trimEndSeconds: number | null;
  date: string;
  createdAt: string;
  pieceName: string | null;
  pieceComposer: string | null;
  sectionLabel: string | null;
  taskText: string;
};

export async function getRecordings(): Promise<Recording[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("practice_tasks")
    .select(
      "id, date, text, audio_path, audio_duration_seconds, audio_trim_start_seconds, audio_trim_end_seconds, created_at, pieces(name, composer), piece_sections(label)"
    )
    .not("audio_path", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const piece = row.pieces as unknown as {
      name: string;
      composer: string | null;
    } | null;
    const section = row.piece_sections as unknown as {
      label: string;
    } | null;
    return {
      taskId: row.id,
      audioPath: row.audio_path as string,
      durationSeconds: row.audio_duration_seconds ?? 0,
      trimStartSeconds: row.audio_trim_start_seconds,
      trimEndSeconds: row.audio_trim_end_seconds,
      date: row.date,
      createdAt: row.created_at,
      pieceName: piece?.name ?? null,
      pieceComposer: piece?.composer ?? null,
      sectionLabel: section?.label ?? null,
      taskText: row.text,
    };
  });
}
