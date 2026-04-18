-- Non-destructive trim points for task audio. The underlying file in storage
-- is never rewritten; playback clamps to [start, end) when set.
ALTER TABLE practice_tasks
  ADD COLUMN audio_trim_start_seconds numeric,
  ADD COLUMN audio_trim_end_seconds numeric;

ALTER TABLE practice_tasks
  ADD CONSTRAINT practice_tasks_audio_trim_valid
  CHECK (
    (audio_trim_start_seconds IS NULL OR audio_trim_start_seconds >= 0)
    AND (audio_trim_end_seconds IS NULL OR audio_trim_end_seconds >= 0)
    AND (
      audio_trim_start_seconds IS NULL
      OR audio_trim_end_seconds IS NULL
      OR audio_trim_start_seconds < audio_trim_end_seconds
    )
  );
