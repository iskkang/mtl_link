-- Tracing report email: state table, audit log, and file_type column on containers.

-- (a) Per-report file type column on containers — stamped by ingest on upload.
ALTER TABLE tcr_containers_current
  ADD COLUMN IF NOT EXISTS file_type TEXT;

CREATE INDEX IF NOT EXISTS idx_tcc_file_type ON tcr_containers_current(file_type);

-- (b) Change-detection state: one row per (report, container).
--     row_hash is a SHA-256 of the display fields — changed hash = send email.
CREATE TABLE IF NOT EXISTS tracing_report_state (
  report_key  TEXT        NOT NULL,
  row_key     TEXT        NOT NULL,
  row_hash    TEXT        NOT NULL,
  raw         JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (report_key, row_key)
);

-- (c) Audit log of every cron run per report.
CREATE TABLE IF NOT EXISTS tracing_report_runs (
  id           BIGSERIAL   PRIMARY KEY,
  report_key   TEXT        NOT NULL,
  run_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed      BOOLEAN     NOT NULL,
  sent         BOOLEAN     NOT NULL,
  row_count    INT,
  changed_rows INT,
  stalled_rows INT,
  error        TEXT
);

ALTER TABLE tracing_report_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracing_report_runs  ENABLE ROW LEVEL SECURITY;
-- No RLS policies added → service role only access.
