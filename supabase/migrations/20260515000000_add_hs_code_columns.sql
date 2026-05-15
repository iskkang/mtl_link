-- HS-code RAG: knowledge_base 테이블에 HS코드 전용 컬럼 추가
ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS hs_code_6digit TEXT,
  ADD COLUMN IF NOT EXISTS hs_code_full   TEXT,
  ADD COLUMN IF NOT EXISTS country_code   TEXT;  -- 'KR' or 'CN'

CREATE INDEX IF NOT EXISTS idx_kb_hs_code_6digit ON knowledge_base(hs_code_6digit);
CREATE INDEX IF NOT EXISTS idx_kb_doc_type        ON knowledge_base(doc_type);
CREATE INDEX IF NOT EXISTS idx_kb_country_code    ON knowledge_base(country_code);
