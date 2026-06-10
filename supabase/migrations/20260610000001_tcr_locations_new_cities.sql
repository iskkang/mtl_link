INSERT INTO tcr_locations (location_name, latitude, longitude) VALUES
  ('Kyrgyz',         40.4500, 72.9000),
  ('kyrgyz',         40.4500, 72.9000),
  ('KYRGYZ',         40.4500, 72.9000),
  ('Wuqia',          39.7167, 75.2500),
  ('wuqia',          39.7167, 75.2500),
  ('WUQIA',          39.7167, 75.2500),
  ('Irkeshtam',      39.6833, 73.9167),
  ('irkeshtam',      39.6833, 73.9167),
  ('IRKESHTAM',      39.6833, 73.9167),
  ('Irkeshstan',     39.6833, 73.9167),
  ('irkeshstan',     39.6833, 73.9167),
  ('IRKESHSTAN',     39.6833, 73.9167),
  ('Shijiazhuangxi', 38.0454, 114.3527),
  ('shijiazhuangxi', 38.0454, 114.3527),
  ('SHIJIAZHUANGXI', 38.0454, 114.3527)
ON CONFLICT (location_name) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;
