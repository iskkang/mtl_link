INSERT INTO tcr_locations (location_name, latitude, longitude) VALUES
  ('Orsha',       54.5075,  30.4186),
  ('orsha',       54.5075,  30.4186),
  ('ORSHA',       54.5075,  30.4186),
  ('Aksu',        41.1216,  80.2644),
  ('aksu',        41.1216,  80.2644),
  ('AKSU',        41.1216,  80.2644),
  ('Zhengzhou',   34.7473, 113.6254),
  ('zhengzhou',   34.7473, 113.6254),
  ('ZHENGZHOU',   34.7473, 113.6254)
ON CONFLICT (location_name) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;
