-- Track section status changes over time for progress reporting
CREATE TABLE section_status_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES piece_sections(id) ON DELETE CASCADE,
  old_status integer NOT NULL,
  new_status integer NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_status_snapshots_piece_date ON section_status_snapshots(piece_id, snapshot_date);
CREATE INDEX idx_status_snapshots_section ON section_status_snapshots(section_id);

CREATE TRIGGER section_status_snapshots_updated_at
  BEFORE UPDATE ON section_status_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE section_status_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access" ON section_status_snapshots FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
