-- AddColumn: subjects.slug
-- AddColumn: topics.slug (nullable, unique per subject)
-- CreateTable: lessons (Lesson Store navigation layer)
--
-- Apply: npx prisma migrate deploy
--   OR paste into Supabase SQL editor if using db push workflow.

-- ── subjects.slug ────────────────────────────────────────────────────────────
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "slug" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "subjects_slug_key" ON "subjects"("slug");

-- ── topics.slug ──────────────────────────────────────────────────────────────
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Unique per subject (NULLs are not considered equal — many NULL slugs are allowed)
CREATE UNIQUE INDEX IF NOT EXISTS "topics_subject_id_slug_key"
    ON "topics"("subject_id", "slug");

-- ── lessons ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lessons" (
    "id"                    UUID         NOT NULL DEFAULT gen_random_uuid(),
    "subject_id"            UUID         NOT NULL,
    "topic_id"              UUID         NOT NULL,
    "curriculum_outcome_id" UUID,
    "title"                 TEXT         NOT NULL,
    "slug"                  TEXT         NOT NULL,
    "lesson_summary"        TEXT,
    "learning_objective"    TEXT,
    "key_stage"             TEXT         NOT NULL,
    "year_group"            TEXT         NOT NULL,
    "difficulty_lane"       TEXT,
    "lesson_type"           TEXT,
    "estimated_minutes"     INTEGER,
    "app_experience"        TEXT,
    "status"                TEXT         NOT NULL DEFAULT 'staged'
                                CHECK ("status" IN ('staged','published','flagged','regenerating')),
    "verification_method"   TEXT,
    "verification_status"   TEXT         NOT NULL DEFAULT 'unverified'
                                CHECK ("verification_status" IN ('verified','unverified','failed')),
    "source_reference"      TEXT,
    "created_at"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lessons_slug_key"
    ON "lessons"("slug");

CREATE INDEX IF NOT EXISTS "lessons_topic_id_status_verification_idx"
    ON "lessons"("topic_id", "status", "verification_status");

-- FKs
ALTER TABLE "lessons"
    ADD CONSTRAINT "lessons_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lessons"
    ADD CONSTRAINT "lessons_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "topics"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lessons"
    ADD CONSTRAINT "lessons_curriculum_outcome_id_fkey"
    FOREIGN KEY ("curriculum_outcome_id") REFERENCES "curriculum_outcomes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
