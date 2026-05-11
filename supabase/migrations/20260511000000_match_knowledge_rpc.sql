-- v2.22 Phase B: match_knowledge RPC with optional user filter
DROP FUNCTION IF EXISTS match_knowledge(vector, float, int);
DROP FUNCTION IF EXISTS match_knowledge(vector, float, int, uuid);

CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding  vector(1536),
  match_threshold  float   DEFAULT 0.7,
  match_count      int     DEFAULT 3,
  p_user_id        uuid    DEFAULT NULL
)
RETURNS TABLE (
  id         uuid,
  title      text,
  content    text,
  category   text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE
    kb.status     = 'verified'
    AND kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
