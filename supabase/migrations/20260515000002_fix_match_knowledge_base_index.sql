-- match_knowledge_base 함수 수정: IVFFlat 인덱스 활성화
-- 문제: WHERE 절에 threshold 조건이 있으면 pgvector가 sequential scan으로 fallback
-- 해결: 내부 KNN은 ORDER BY ... LIMIT 만 사용 (index 활성화), 외부에서 threshold 필터

CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding  vector(1536),
  match_threshold  float   DEFAULT 0.7,
  match_count      int     DEFAULT 5,
  filter_issue_type text   DEFAULT NULL,
  filter_region    text    DEFAULT NULL
)
RETURNS TABLE (
  id            uuid,
  filename      text,
  content       text,
  doc_type      text,
  issue_type    text,
  region        text,
  similarity    float
)
LANGUAGE sql STABLE AS $$
  SELECT id, filename, content, doc_type, issue_type, region, similarity
  FROM (
    SELECT
      id, filename, content, doc_type, issue_type, region,
      1 - (embedding <=> query_embedding) AS similarity
    FROM knowledge_base
    WHERE
      (filter_issue_type IS NULL OR issue_type = filter_issue_type)
      AND (filter_region IS NULL OR region = filter_region)
      AND embedding IS NOT NULL
    ORDER BY embedding <=> query_embedding          -- IVFFlat 인덱스 사용
    LIMIT match_count * 10                          -- 여유 있게 fetch
  ) sub
  WHERE similarity > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
