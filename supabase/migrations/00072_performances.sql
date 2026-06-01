-- Performances: the user's own YouTube recordings of a piece or a whole work
-- (e.g. a chamber piece performed with collaborators). Distinct from
-- piece_videos, which is a section-practice reference video.
CREATE TABLE performances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  piece_id uuid REFERENCES pieces(id) ON DELETE CASCADE,
  work_id uuid REFERENCES works(id) ON DELETE CASCADE,
  youtube_video_id text NOT NULL,
  title text,
  performers text,
  location text,
  performed_on date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  -- A performance belongs to exactly one owner: a piece XOR a work.
  CONSTRAINT performances_one_owner CHECK ((piece_id IS NOT NULL) <> (work_id IS NOT NULL))
);

CREATE INDEX idx_performances_piece_id ON performances(piece_id);
CREATE INDEX idx_performances_work_id ON performances(work_id);

CREATE TRIGGER performances_updated_at
  BEFORE UPDATE ON performances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE performances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON performances FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
