-- Raise task-audio bucket cap to fit ~60 min stereo Opus at 256 kbps (~115 MB).
UPDATE storage.buckets
SET file_size_limit = 150 * 1024 * 1024
WHERE id = 'task-audio';
