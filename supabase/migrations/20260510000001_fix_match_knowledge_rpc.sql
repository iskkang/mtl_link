-- Drop old match_knowledge signature and recreate with correct return type
DROP FUNCTION IF EXISTS match_knowledge(vector, float, int);

CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding  vector(1536),
  match_threshold  float DEFAULT 0.5,
  match_count      int   DEFAULT 5
)
RETURNS TABLE (
  id         uuid,
  title      text,
  category   text,
  content    text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    title,
    category,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base
  WHERE
    status    = 'verified'
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
