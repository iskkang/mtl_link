-- knowledge_base 테이블에 관리자 승인 워크플로우 컬럼 추가
ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS title       TEXT,
  ADD COLUMN IF NOT EXISTS category    TEXT,
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- status 인덱스 (pending_review/draft 빠른 조회용)
CREATE INDEX IF NOT EXISTS knowledge_base_status_idx ON knowledge_base (status);

-- ingest 스크립트로 삽입된 기존 행은 already verified 상태로 유지
-- (DEFAULT 'verified' 로 처리됨)
