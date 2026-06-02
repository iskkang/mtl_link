-- Add transit_time_days column to store the "Total T/T" value from Excel uploads.
-- Parsed from the "Total T/T" column present in CN_UZ and KR_UZ Excel files.

ALTER TABLE tcr_containers_current
  ADD COLUMN IF NOT EXISTS transit_time_days INTEGER;
