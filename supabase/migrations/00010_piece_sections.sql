-- Add target_tempo to pieces
ALTER TABLE pieces ADD COLUMN target_tempo integer;

-- Piece sections table (A, B, C as parents; A1, A2 as children via parent_id)
CREATE TABLE piece_sections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES piece_sections(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status integer NOT NULL DEFAULT 0,  -- 0=not started, 1=25%, 2=50%, 3=75%, 4=90%, 5=100%
  target_tempo integer,               -- NULL = inherit from piece.target_tempo
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_piece_sections_piece_id ON piece_sections(piece_id);
CREATE INDEX idx_piece_sections_parent_id ON piece_sections(parent_id);

CREATE TRIGGER piece_sections_updated_at
  BEFORE UPDATE ON piece_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE piece_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON piece_sections FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Piece videos table (for Phase 2 YouTube integration, schema created now)
CREATE TABLE piece_videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  youtube_video_id text NOT NULL,
  title text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_piece_videos_piece_id ON piece_videos(piece_id);

CREATE TRIGGER piece_videos_updated_at
  BEFORE UPDATE ON piece_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE piece_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON piece_videos FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Section timestamps linking sections to video positions (for Phase 2)
CREATE TABLE piece_section_timestamps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id uuid NOT NULL REFERENCES piece_sections(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES piece_videos(id) ON DELETE CASCADE,
  start_seconds real NOT NULL,
  end_seconds real,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(section_id, video_id)
);

CREATE INDEX idx_piece_section_timestamps_video ON piece_section_timestamps(video_id);

CREATE TRIGGER piece_section_timestamps_updated_at
  BEFORE UPDATE ON piece_section_timestamps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE piece_section_timestamps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON piece_section_timestamps FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Section tracking on timer entries
ALTER TABLE timer_entries ADD COLUMN section_id uuid REFERENCES piece_sections(id) ON DELETE SET NULL;
CREATE INDEX idx_timer_entries_section_id ON timer_entries(section_id);
