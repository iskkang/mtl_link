INSERT INTO tcr_locations (location_name, latitude, longitude) VALUES
  ('Yakela',   39.3453,  79.1669),
  ('yakela',   39.3453,  79.1669),
  ('YAKELA',   39.3453,  79.1669),
  ('Eji',      41.9545, 101.0557),
  ('eji',      41.9545, 101.0557),
  ('EJI',      41.9545, 101.0557),
  ('Dingbian', 37.5615, 107.5772),
  ('dingbian', 37.5615, 107.5772),
  ('DINGBIAN', 37.5615, 107.5772)
ON CONFLICT (location_name) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;
