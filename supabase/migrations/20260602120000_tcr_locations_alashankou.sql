-- Add Alashankou (China-Kazakhstan border crossing) and Khorgos to tcr_locations.
-- These appear as current_location values in KR_EU Excel files.
-- Both uppercase (raw Excel) and title-case (post-LOC_MAP normalized) variants are added
-- so geo lookup works for both existing DB rows and new uploads.

INSERT INTO tcr_locations (location_name, latitude, longitude) VALUES
  ('ALASHANKOU',  45.404,  82.574),   -- raw Excel value already in DB
  ('Alashankou',  45.404,  82.574),   -- normalized form after LOC_MAP fix
  ('KHORGOS',     44.213,  80.420),   -- Horgos/Khorgos border (CN side)
  ('Khorgos',     44.213,  80.420)
ON CONFLICT (location_name) DO NOTHING;
