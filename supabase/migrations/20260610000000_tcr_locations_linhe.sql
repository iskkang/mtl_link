INSERT INTO tcr_locations (location_name, latitude, longitude) VALUES
  ('Linhe',  40.7756, 107.3953),
  ('LINHE',  40.7756, 107.3953),
  ('linhe',  40.7756, 107.3953)
ON CONFLICT (location_name) DO NOTHING;
