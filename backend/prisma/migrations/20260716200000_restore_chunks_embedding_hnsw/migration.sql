-- Restore HNSW index for fast cosine similarity search on chunk embeddings.
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
ON "chunks"
USING hnsw (embedding vector_cosine_ops);
