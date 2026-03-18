-- Practice Book: Initial Schema
-- All tables for the complete app, with RLS policies.

-- ============================================================
-- Custom enum types
-- ============================================================

CREATE TYPE piece_status AS ENUM ('active', 'upcoming', 'archived');
CREATE TYPE mastery_level AS ENUM ('learning', 'playable', 'performance_ready', 'memorized');
CREATE TYPE timer_category AS ENUM ('piece', 'technique', 'sight_reading');
CREATE TYPE entry_section_category AS ENUM ('piece', 'technique', 'sight_reading', 'general');
CREATE TYPE source_type AS ENUM ('practice_entry', 'lesson');

-- ============================================================
-- Utility: updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Tables
-- ============================================================

-- Repertoire: Collections
CREATE TABLE collections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  composer text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Repertoire: Pieces
CREATE TABLE pieces (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id uuid REFERENCES collections(id) ON DELETE SET NULL,
  name text NOT NULL,
  composer text NOT NULL,
  status piece_status NOT NULL DEFAULT 'active',
  mastery_level mastery_level NOT NULL DEFAULT 'learning',
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_pieces_collection_id ON pieces(collection_id);
CREATE INDEX idx_pieces_status ON pieces(status);

CREATE TRIGGER pieces_updated_at
  BEFORE UPDATE ON pieces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Repertoire: Bookmarks
CREATE TABLE bookmarks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  name text NOT NULL,
  measure_start int NOT NULL,
  measure_end int,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_bookmarks_piece_id ON bookmarks(piece_id);

-- Timer: Practice Sessions
CREATE TABLE practice_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_practice_sessions_date ON practice_sessions(date);

-- Timer: Timer Entries
CREATE TABLE timer_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  piece_id uuid REFERENCES pieces(id) ON DELETE SET NULL,
  category timer_category NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz
);

CREATE INDEX idx_timer_entries_session_id ON timer_entries(session_id);
CREATE INDEX idx_timer_entries_piece_id ON timer_entries(piece_id);

-- Practice Log: Practice Entries
CREATE TABLE practice_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_practice_entries_date ON practice_entries(date);

CREATE TRIGGER practice_entries_updated_at
  BEFORE UPDATE ON practice_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Practice Log: Practice Entry Sections
CREATE TABLE practice_entry_sections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_entry_id uuid NOT NULL REFERENCES practice_entries(id) ON DELETE CASCADE,
  piece_id uuid REFERENCES pieces(id) ON DELETE SET NULL,
  category entry_section_category NOT NULL,
  content jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_practice_entry_sections_entry ON practice_entry_sections(practice_entry_id);
CREATE INDEX idx_practice_entry_sections_piece ON practice_entry_sections(piece_id);

CREATE TRIGGER practice_entry_sections_updated_at
  BEFORE UPDATE ON practice_entry_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Lesson Log: Lessons
CREATE TABLE lessons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  content jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_lessons_date ON lessons(date);

CREATE TRIGGER lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Lesson Log: Goals
CREATE TABLE goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  piece_id uuid REFERENCES pieces(id) ON DELETE SET NULL,
  text text NOT NULL,
  content jsonb,
  completed boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_goals_lesson_id ON goals(lesson_id);
CREATE INDEX idx_goals_piece_id ON goals(piece_id);

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Mentions (backlinks)
CREATE TABLE mentions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  source_type source_type NOT NULL,
  source_id uuid NOT NULL,
  context_snippet text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_mentions_piece_id ON mentions(piece_id);
CREATE INDEX idx_mentions_source ON mentions(source_type, source_id);

-- Inline Tasks
CREATE TABLE tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type source_type NOT NULL,
  source_id uuid NOT NULL,
  piece_id uuid REFERENCES pieces(id) ON DELETE SET NULL,
  text text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_tasks_piece_id ON tasks(piece_id);
CREATE INDEX idx_tasks_source ON tasks(source_type, source_id);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON collections FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON pieces FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON bookmarks FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON practice_sessions FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE timer_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON timer_entries FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE practice_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON practice_entries FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE practice_entry_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON practice_entry_sections FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON lessons FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON goals FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON mentions FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON tasks FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
