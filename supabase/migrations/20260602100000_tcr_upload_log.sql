-- TCR upload audit log: records every file upload to tcr_upload_log
-- so admins can verify who uploaded what and when, regardless of browser.

CREATE TABLE IF NOT EXISTS tcr_upload_log (
  id               BIGSERIAL PRIMARY KEY,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploader_ip      TEXT,
  file_name        TEXT NOT NULL DEFAULT '',
  file_type        TEXT NOT NULL DEFAULT '',
  containers_count INTEGER NOT NULL DEFAULT 0,
  segments_count   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tcr_upload_log_uploaded_at
  ON tcr_upload_log (uploaded_at DESC);
