-- Fix: re-seed sections, video, and timestamps for Trio in G major
-- The previous migration (00013) skipped because the piece already had sections.
-- This migration cleans up and re-inserts all data.
-- Production piece ID: 671174b8-96df-46b9-bc39-2ceb999a22da

DO $$
DECLARE
  v_piece_id uuid := '671174b8-96df-46b9-bc39-2ceb999a22da';
  v_video_id uuid;
  v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_e uuid; v_f uuid; v_g uuid; v_h uuid; v_i uuid;
  v_a1 uuid; v_a2 uuid; v_a3 uuid;
  v_b1 uuid; v_b2 uuid;
  v_c1 uuid; v_c2 uuid; v_c3 uuid; v_c4 uuid; v_c5 uuid;
  v_d1 uuid; v_d2 uuid; v_d3 uuid;
  v_f1 uuid; v_f2 uuid; v_f3 uuid;
BEGIN
  -- Skip if piece doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pieces WHERE id = v_piece_id) THEN RETURN; END IF;

  -- Clean up existing data for this piece
  DELETE FROM piece_section_timestamps WHERE section_id IN (
    SELECT id FROM piece_sections WHERE piece_id = v_piece_id
  );
  DELETE FROM piece_videos WHERE piece_id = v_piece_id;
  DELETE FROM piece_sections WHERE piece_id = v_piece_id;

  -- Set piece target tempo
  UPDATE pieces SET target_tempo = 65 WHERE id = v_piece_id;

  -- Generate UUIDs
  v_a := gen_random_uuid(); v_b := gen_random_uuid(); v_c := gen_random_uuid();
  v_d := gen_random_uuid(); v_e := gen_random_uuid(); v_f := gen_random_uuid();
  v_g := gen_random_uuid(); v_h := gen_random_uuid(); v_i := gen_random_uuid();
  v_a1 := gen_random_uuid(); v_a2 := gen_random_uuid(); v_a3 := gen_random_uuid();
  v_b1 := gen_random_uuid(); v_b2 := gen_random_uuid();
  v_c1 := gen_random_uuid(); v_c2 := gen_random_uuid(); v_c3 := gen_random_uuid();
  v_c4 := gen_random_uuid(); v_c5 := gen_random_uuid();
  v_d1 := gen_random_uuid(); v_d2 := gen_random_uuid(); v_d3 := gen_random_uuid();
  v_f1 := gen_random_uuid(); v_f2 := gen_random_uuid(); v_f3 := gen_random_uuid();

  -- Parent sections
  INSERT INTO piece_sections (id, piece_id, label, parent_id, sort_order, status, target_tempo) VALUES
    (v_a, v_piece_id, 'A', NULL, 0, 0, NULL),
    (v_b, v_piece_id, 'B', NULL, 1, 0, NULL),
    (v_c, v_piece_id, 'C', NULL, 2, 0, NULL),
    (v_d, v_piece_id, 'D', NULL, 3, 0, NULL),
    (v_e, v_piece_id, 'E', NULL, 4, 8, NULL),   -- complete (green)
    (v_f, v_piece_id, 'F', NULL, 5, 0, NULL),
    (v_g, v_piece_id, 'G', NULL, 6, 6, NULL),   -- 90% (dark blue)
    (v_h, v_piece_id, 'H', NULL, 7, 3, NULL),   -- 60% (mid blue)
    (v_i, v_piece_id, 'I', NULL, 8, 7, NULL);   -- 100% (darkest blue)

  -- Child sections — spread statuses 0-8 across leaves to demo all colors
  INSERT INTO piece_sections (id, piece_id, label, parent_id, sort_order, status, target_tempo) VALUES
    (v_a1, v_piece_id, 'A1', v_a, 0, 8, NULL),   -- complete (green)
    (v_a2, v_piece_id, 'A2', v_a, 1, 7, NULL),   -- 100% (darkest blue)
    (v_a3, v_piece_id, 'A3', v_a, 2, 6, NULL),   -- 90%
    (v_b1, v_piece_id, 'B1', v_b, 0, 5, NULL),   -- 80%
    (v_b2, v_piece_id, 'B2', v_b, 1, 4, 108),    -- 70%
    (v_c1, v_piece_id, 'C1', v_c, 0, 3, NULL),   -- 60%
    (v_c2, v_piece_id, 'C2', v_c, 1, 2, NULL),   -- 50%
    (v_c3, v_piece_id, 'C3', v_c, 2, 1, NULL),   -- 40% (lightest blue)
    (v_c4, v_piece_id, 'C4', v_c, 3, 0, NULL),   -- not started (white)
    (v_c5, v_piece_id, 'C5', v_c, 4, 8, NULL),   -- complete (green)
    (v_d1, v_piece_id, 'D1', v_d, 0, 6, NULL),   -- 90%
    (v_d2, v_piece_id, 'D2', v_d, 1, 3, NULL),   -- 60%
    (v_d3, v_piece_id, 'D3', v_d, 2, 0, NULL),   -- not started
    (v_f1, v_piece_id, 'F1', v_f, 0, 7, NULL),   -- 100%
    (v_f2, v_piece_id, 'F2', v_f, 1, 4, NULL),   -- 70%
    (v_f3, v_piece_id, 'F3', v_f, 2, 1, NULL);   -- 40%

  -- Video
  INSERT INTO piece_videos (id, piece_id, youtube_video_id, title, start_seconds, end_seconds)
  VALUES (gen_random_uuid(), v_piece_id, 'o2B4B4p7BDg', 'Debussy Trio in G major', 3, 493)
  RETURNING id INTO v_video_id;

  -- Timestamps
  INSERT INTO piece_section_timestamps (section_id, video_id, start_seconds, end_seconds) VALUES
    (v_a,  v_video_id, 2,   NULL),
    (v_a1, v_video_id, 2,   NULL),
    (v_a2, v_video_id, 11,  NULL),
    (v_a3, v_video_id, 67,  NULL),
    (v_b1, v_video_id, 83,  NULL),
    (v_b2, v_video_id, 116, NULL),
    (v_c1, v_video_id, 147, NULL),
    (v_c2, v_video_id, 161, NULL),
    (v_c3, v_video_id, 171, NULL),
    (v_c4, v_video_id, 182, NULL),
    (v_c5, v_video_id, 187, NULL),
    (v_d1, v_video_id, 194, NULL),
    (v_d2, v_video_id, 212, NULL),
    (v_d3, v_video_id, 234, NULL),
    (v_e,  v_video_id, 249, NULL),
    (v_f,  v_video_id, 273, NULL),
    (v_f1, v_video_id, 273, NULL),
    (v_f2, v_video_id, 291, NULL),
    (v_f3, v_video_id, 313, NULL),
    (v_g,  v_video_id, 321, NULL),
    (v_h,  v_video_id, 367, NULL),
    (v_i,  v_video_id, 405, NULL);
END $$;
