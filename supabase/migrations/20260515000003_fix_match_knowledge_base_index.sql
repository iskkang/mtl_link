-- IVFFlat 인덱스를 활용하도록 match_knowledge_base 함수 재작성
-- 이전 마이그레이션 20260515000002에서 서브쿼리 패턴으로 인해
-- 인덱스가 비활성화되었던 문제 수정
--
-- 핵심 원칙:
--   ORDER BY embedding <=> query LIMIT n 이 최상위 쿼리에 있어야 IVFFlat 인덱스 사용
--   서브쿼리로 감싸면 플래너가 sequential scan으로 fallback
--   threshold 필터는 호출 측(Edge Function)에서 후처리

DROP FUNCTION IF EXISTS match_knowledge_base(vector(1536), float, int, text, text);

CREATE FUNCTION match_knowledge_base(
  query_embedding   vector(1536),
  match_threshold   float   DEFAULT 0.5,
  match_count       int     DEFAULT 5,
  filter_issue_type text    DEFAULT NULL,
  filter_region     text    DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  filename    text,
  doc_type    text,
  issue_type  text,
  content     text,
  similarity  float
)
LANGUAGE plpgsql AS $$
BEGIN
  -- IVFFlat: lists=150 기준 probes=20 → 탐색 범위 13%, 속도 2-3초 이내
  -- probes=1(default)은 recall 너무 낮아 HS-code 검색 실패
  SET LOCAL ivfflat.probes = 20;

  RETURN QUERY
  SELECT
    kb.id,
    kb.filename,
    kb.doc_type,
    kb.issue_type,
    kb.content,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE
    (filter_issue_type IS NULL OR kb.issue_type = filter_issue_type)
    AND (filter_region IS NULL OR kb.region = filter_region)
    AND kb.embedding IS NOT NULL
  ORDER BY kb.embedding <=> query_embedding   -- 최상위 ORDER BY (IVFFlat 인덱스 조건)
  LIMIT match_count;
  -- threshold 필터는 호출 측에서 처리 (서브쿼리 금지)
END;
$$;

COMMENT ON FUNCTION match_knowledge_base IS
'pgvector IVFFlat 인덱스 활용 KB 유사도 검색.
ORDER BY <=> LIMIT 가 최상위에 있어야 인덱스 사용됨.
threshold 필터는 호출 측(Edge Function)에서 후처리.
probes=10 으로 recall/속도 균형 확보.';
