-- Sessions: divide a day's practice tasks into ordered sessions (morning/afternoon/etc.)
ALTER TABLE practice_tasks
  ADD COLUMN session_number integer NOT NULL DEFAULT 1;

CREATE INDEX idx_practice_tasks_date_session
  ON practice_tasks (date, session_number, sort_order);
