-- Practice tasks: short-term, timer-based focused practice items scoped to a day
CREATE TABLE practice_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  section_id uuid REFERENCES piece_sections(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  text text NOT NULL DEFAULT '',
  metronome_speed integer,
  timer_seconds integer NOT NULL DEFAULT 900,
  timer_remaining_seconds integer NOT NULL DEFAULT 900,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_practice_tasks_piece_id ON practice_tasks(piece_id);
CREATE INDEX idx_practice_tasks_date ON practice_tasks(date);

CREATE TRIGGER practice_tasks_updated_at
  BEFORE UPDATE ON practice_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE practice_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON practice_tasks FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
