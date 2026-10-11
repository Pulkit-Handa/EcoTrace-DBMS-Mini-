-- ===========================================================================
-- EcoTrace — optional pgvector migration (novelty feature)
-- Adds vector storage to the existing relational bridge WITHOUT adding a
-- sixth table. If pgvector is unavailable, setup continues without it and
-- the application gracefully falls back to MongoDB full-text search.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE vendor_reports
    ADD COLUMN IF NOT EXISTS embedding vector(384);

-- HNSW index for fast cosine-similarity search.
CREATE INDEX IF NOT EXISTS idx_vendor_reports_embedding
    ON vendor_reports
    USING hnsw (embedding vector_cosine_ops);

COMMENT ON COLUMN vendor_reports.embedding IS
    '384-dimension local embedding of the linked MongoDB document, used for pgvector semantic search.';
