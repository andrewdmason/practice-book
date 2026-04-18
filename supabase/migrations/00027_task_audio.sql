-- Per-task audio recording: one optional recording per practice task.
ALTER TABLE practice_tasks
  ADD COLUMN audio_path text,
  ADD COLUMN audio_duration_seconds integer;

ALTER TABLE practice_tasks
  ADD CONSTRAINT practice_tasks_audio_consistency
  CHECK (
    (audio_path IS NULL AND audio_duration_seconds IS NULL)
    OR (audio_path IS NOT NULL AND audio_duration_seconds IS NOT NULL AND audio_duration_seconds >= 0)
  );

-- Private bucket for task audio. Path convention: {auth.uid()}/{task_id}.{ext}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-audio',
  'task-audio',
  false,
  10 * 1024 * 1024,
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "task-audio owner select" ON storage.objects;
DROP POLICY IF EXISTS "task-audio owner insert" ON storage.objects;
DROP POLICY IF EXISTS "task-audio owner update" ON storage.objects;
DROP POLICY IF EXISTS "task-audio owner delete" ON storage.objects;

CREATE POLICY "task-audio owner select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'task-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "task-audio owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'task-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "task-audio owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'task-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "task-audio owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'task-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
