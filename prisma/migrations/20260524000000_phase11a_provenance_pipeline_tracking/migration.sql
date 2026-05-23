-- Phase 11A: Provenance fields, practice_games status gate, pipeline tracking tables
-- CLAUDE.md §14 Phase 11A

-- ── learn_content: provenance fields ─────────────────────────────────────
ALTER TABLE "learn_content"
  ADD COLUMN IF NOT EXISTS "confidence_score"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "source_chunk_ids"  JSONB,
  ADD COLUMN IF NOT EXISTS "generator_version" TEXT,
  ADD COLUMN IF NOT EXISTS "published_at"      TIMESTAMPTZ;

-- ── practice_games: published gate ───────────────────────────────────────
-- Add status column using the ContentStatus enum. Default is 'staged' so
-- existing rows are not immediately exposed to children.
ALTER TABLE "practice_games"
  ADD COLUMN IF NOT EXISTS "status" "ContentStatus" NOT NULL DEFAULT 'staged';

-- ── quiz_questions: provenance fields ─────────────────────────────────────
ALTER TABLE "quiz_questions"
  ADD COLUMN IF NOT EXISTS "question_metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "generator_version" TEXT,
  ADD COLUMN IF NOT EXISTS "verifier_version"  TEXT,
  ADD COLUMN IF NOT EXISTS "published_at"      TIMESTAMPTZ;

-- Set published_at for existing published questions (backfill)
UPDATE "quiz_questions"
SET "published_at" = "created_at"
WHERE "status" = 'published' AND "published_at" IS NULL;

-- ── pipeline_runs table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pipeline_runs" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "run_type"         TEXT        NOT NULL,
  "year_group"       TEXT        NOT NULL,
  "subject"          TEXT        NOT NULL,
  "topic_id"         UUID,
  "tier"             TEXT,
  "status"           TEXT        NOT NULL DEFAULT 'running',
  "items_attempted"  INTEGER     NOT NULL DEFAULT 0,
  "items_published"  INTEGER     NOT NULL DEFAULT 0,
  "items_staged"     INTEGER     NOT NULL DEFAULT 0,
  "items_failed"     INTEGER     NOT NULL DEFAULT 0,
  "error_log"        JSONB       NOT NULL DEFAULT '[]',
  "started_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at"     TIMESTAMPTZ,
  "pipeline_version" TEXT,
  CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pipeline_runs_year_group_subject_idx"
  ON "pipeline_runs" ("year_group", "subject");

CREATE INDEX IF NOT EXISTS "pipeline_runs_status_idx"
  ON "pipeline_runs" ("status");

-- ── generation_errors table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "generation_errors" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "pipeline_run_id"  UUID,
  "topic_id"         UUID,
  "question_type"    TEXT,
  "tier"             TEXT,
  "stage_failed"     INTEGER,
  "error_message"    TEXT        NOT NULL,
  "raw_llm_output"   JSONB,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "generation_errors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "generation_errors_pipeline_run_id_fkey"
    FOREIGN KEY ("pipeline_run_id")
    REFERENCES "pipeline_runs"("id")
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "generation_errors_pipeline_run_id_idx"
  ON "generation_errors" ("pipeline_run_id");

CREATE INDEX IF NOT EXISTS "generation_errors_topic_id_idx"
  ON "generation_errors" ("topic_id");
