-- 벡터 인덱스 재생성 (IVFFlat, 무료 플랜 호환)
-- maintenance_work_mem 80MB + statement_timeout=0 으로 빌드 제약 우회
-- IVFFlat은 shared memory 미사용, process memory만 사용

SET statement_timeout = 0;
SET maintenance_work_mem = '80MB';

DROP INDEX IF EXISTS knowledge_base_embedding_idx;

CREATE INDEX knowledge_base_embedding_idx
  ON knowledge_base
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 150);

ANALYZE knowledge_base;

RESET maintenance_work_mem;
RESET statement_timeout;
