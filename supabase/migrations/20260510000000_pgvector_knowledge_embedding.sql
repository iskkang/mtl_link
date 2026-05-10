-- v2.22 Phase A: pgvector + knowledge_base embedding columns + match_knowledge RPC

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding / chunking columns to knowledge_base
ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS embedding   vector(1536),
  ADD COLUMN IF NOT EXISTS source_file text,
  ADD COLUMN IF NOT EXISTS chunk_index int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chunk_total int NOT NULL DEFAULT 1;

-- 3. IVFFlat index for fast cosine similarity search
--    lists=1 is safe for an initially-empty table; tune upward as rows grow
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx
  ON public.knowledge_base
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 1);

-- match_knowledge RPC is created/fixed in 20260510000001_fix_match_knowledge_rpc.sql
