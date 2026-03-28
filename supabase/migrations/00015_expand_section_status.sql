-- Expand section status range from 0-5 to 0-8
-- 0=not started, 1=40%, 2=50%, 3=60%, 4=70%, 5=80%, 6=90%, 7=100%, 8=complete
COMMENT ON COLUMN piece_sections.status IS '0=not started, 1=40%, 2=50%, 3=60%, 4=70%, 5=80%, 6=90%, 7=100%, 8=complete';
