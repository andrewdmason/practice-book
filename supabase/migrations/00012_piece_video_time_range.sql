-- Add optional start/end time range to piece_videos
-- Constrains playback to a portion of the video (e.g. a single movement)
ALTER TABLE piece_videos ADD COLUMN start_seconds real;
ALTER TABLE piece_videos ADD COLUMN end_seconds real;
