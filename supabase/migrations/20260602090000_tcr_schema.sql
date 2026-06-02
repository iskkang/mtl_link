-- Full TCR tracking schema.
-- Creates all tables needed by api/tcr/index.ts from scratch.
-- Safe to run even if tables already exist (uses IF NOT EXISTS).

-- ── 1. Locations (no FK dependencies) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tcr_locations (
  location_name  TEXT PRIMARY KEY,
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION
);

-- ── 2. Containers (main table) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tcr_containers_current (
  container_no            TEXT PRIMARY KEY,
  origin                  TEXT,
  destination             TEXT,
  transport_mode          TEXT,
  current_location        TEXT,
  current_location_raw    TEXT,
  current_location_since  DATE,
  eta_final               DATE,
  ata_final               DATE,
  arrived_yn              BOOLEAN NOT NULL DEFAULT FALSE,
  customer_list           TEXT,
  load_type               TEXT,
  transit_time_days       INTEGER,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Route segments (FK → containers) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS tcr_route_segments (
  segment_id          TEXT PRIMARY KEY,
  container_no        TEXT NOT NULL REFERENCES tcr_containers_current(container_no) ON DELETE CASCADE,
  segment_no          INTEGER NOT NULL,
  segment_name        TEXT,
  from_location       TEXT,
  to_location         TEXT,
  etd                 DATE,
  atd                 DATE,
  eta                 DATE,
  ata                 DATE,
  is_current_segment  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (container_no, segment_no)
);

CREATE INDEX IF NOT EXISTS idx_tcr_route_segments_container_no
  ON tcr_route_segments (container_no);

CREATE INDEX IF NOT EXISTS idx_tcr_route_segments_is_current
  ON tcr_route_segments (is_current_segment) WHERE is_current_segment = TRUE;

-- ── 4. Risk alerts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tcr_risk_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_no  TEXT NOT NULL,
  alert_type    TEXT NOT NULL,
  severity      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Open',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tcr_risk_alerts_container_no
  ON tcr_risk_alerts (container_no);

CREATE INDEX IF NOT EXISTS idx_tcr_risk_alerts_status
  ON tcr_risk_alerts (status);

-- ── 5. Shipment items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tcr_shipment_items (
  id            BIGSERIAL PRIMARY KEY,
  container_no  TEXT NOT NULL REFERENCES tcr_containers_current(container_no) ON DELETE CASCADE,
  item_name     TEXT,
  hs_code       TEXT,
  quantity      NUMERIC,
  unit          TEXT,
  gross_weight  NUMERIC,
  cbm           NUMERIC,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tcr_shipment_items_container_no
  ON tcr_shipment_items (container_no);

-- ── 6. Auto-update updated_at on containers ───────────────────────────────────
CREATE OR REPLACE FUNCTION tcr_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tcr_containers_updated_at ON tcr_containers_current;
CREATE TRIGGER trg_tcr_containers_updated_at
  BEFORE UPDATE ON tcr_containers_current
  FOR EACH ROW EXECUTE FUNCTION tcr_set_updated_at();
