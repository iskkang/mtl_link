-- probes=10 → 20: recall 향상 (lists=150 기준 13% 탐색)
-- 20260515000003에서 함수 재생성 후 probes 수정 누락분 보완

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
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_knowledge_base IS
'pgvector IVFFlat 인덱스 활용 KB 유사도 검색. probes=20 (lists=150 기준 13% 탐색).
ORDER BY <=> LIMIT 최상위 배치로 인덱스 활성화. threshold 필터는 호출 측에서 후처리.';
