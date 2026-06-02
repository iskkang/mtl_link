INSERT INTO tcr_locations (location_name, latitude, longitude) VALUES
  ('GANSU',  36.06964615432799, 103.83928107773178),
  ('Gansu',  36.06964615432799, 103.83928107773178)
ON CONFLICT (location_name) DO NOTHING;
