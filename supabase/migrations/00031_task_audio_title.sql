-- Custom user-supplied name for a task's recording. Independent of the task
-- text and the piece/section labels — these are derived defaults; the title
-- is the user's chosen label for the recording itself.
ALTER TABLE practice_tasks
  ADD COLUMN audio_title text;
