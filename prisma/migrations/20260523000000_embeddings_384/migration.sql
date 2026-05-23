-- Switch curriculum_chunks.embedding from vector(1536) to vector(384).
-- All existing embeddings are NULL (OpenAI key was never active), so drop+add is safe.
ALTER TABLE "curriculum_chunks" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "curriculum_chunks" ADD COLUMN "embedding" vector(384);
