-- Supabase Dashboard → SQL Editor에서 실행
-- Step 1: pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: knowledge_base 테이블 생성
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(1536),        -- OpenAI text-embedding-3-small 차원
  -- frontmatter 메타데이터
  doc_type TEXT,
  domain TEXT,
  issue_type TEXT,
  region TEXT,
  mode TEXT,
  risk_level TEXT,
  cargo_type TEXT,
  last_updated DATE,
  -- 시스템
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- 중복 방지
  UNIQUE (filename, chunk_index)
);

-- Step 3: 벡터 인덱스 (검색 속도) — HNSW (메모리 제약 없음, IVFFlat 대체)
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx ON knowledge_base
  USING hnsw (embedding vector_cosine_ops);

-- Step 4: 메타데이터 인덱스
CREATE INDEX IF NOT EXISTS knowledge_base_doc_issue_idx ON knowledge_base (doc_type, issue_type);
CREATE INDEX IF NOT EXISTS knowledge_base_region_mode_idx ON knowledge_base (region, mode);

-- Step 5: 유사도 검색 함수
CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_issue_type text DEFAULT NULL,
  filter_region text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  filename text,
  content text,
  doc_type text,
  issue_type text,
  region text,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, filename, content, doc_type, issue_type, region,
    1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_base
  WHERE
    (filter_issue_type IS NULL OR issue_type = filter_issue_type)
    AND (filter_region IS NULL OR region = filter_region)
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Step 6: RLS 설정
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'knowledge_base'
      AND policyname = 'Service role can do everything'
  ) THEN
    CREATE POLICY "Service role can do everything"
      ON knowledge_base FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 완료 확인
SELECT 'knowledge_base 테이블 생성 완료' AS status;
