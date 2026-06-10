INSERT INTO tcr_locations (location_name, latitude, longitude) VALUES
  ('Kostanay',  53.2141,  63.6242),
  ('kostanay',  53.2141,  63.6242),
  ('KOSTANAY',  53.2141,  63.6242),
  ('Issyk-Kul', 42.4900,  77.2000),
  ('issyk-kul', 42.4900,  77.2000),
  ('ISSYK-KUL', 42.4900,  77.2000),
  ('Issyk Kul', 42.4900,  77.2000),
  ('issyk kul', 42.4900,  77.2000),
  ('ISSYK KUL', 42.4900,  77.2000)
ON CONFLICT (location_name) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;
