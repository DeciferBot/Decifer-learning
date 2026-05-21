-- CreateTable: curriculum_outcomes
-- Maps official England National Curriculum outcomes to Decifer Learning topics.
-- Scope for MVP: England NC KS1+KS2, Mathematics only.

CREATE TABLE "curriculum_outcomes" (
    "id"                     UUID          NOT NULL DEFAULT gen_random_uuid(),
    "framework_country"      TEXT          NOT NULL DEFAULT 'England',
    "framework_name"         TEXT          NOT NULL DEFAULT 'National Curriculum 2014',
    "key_stage"              TEXT          NOT NULL,
    "year_group"             TEXT          NOT NULL,
    "subject"                TEXT          NOT NULL DEFAULT 'Mathematics',
    "domain"                 TEXT          NOT NULL,
    "statutory_outcome"      TEXT          NOT NULL,
    "non_statutory_notes"    TEXT,
    "source_reference"       TEXT          NOT NULL,
    "app_subject_id"         UUID,
    "app_topic_id"           UUID,
    "app_skill_id"           TEXT,
    "required_content_types" TEXT[]        NOT NULL DEFAULT '{}',
    "coverage_status"        TEXT          NOT NULL DEFAULT 'unmapped',
    "verification_status"    TEXT          NOT NULL DEFAULT 'unverified',
    "created_at"             TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_outcomes_pkey" PRIMARY KEY ("id")
);

-- FKs (nullable — outcomes may exist before app topics are created)
ALTER TABLE "curriculum_outcomes"
    ADD CONSTRAINT "curriculum_outcomes_app_subject_id_fkey"
    FOREIGN KEY ("app_subject_id") REFERENCES "subjects"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "curriculum_outcomes"
    ADD CONSTRAINT "curriculum_outcomes_app_topic_id_fkey"
    FOREIGN KEY ("app_topic_id") REFERENCES "topics"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for common queries
CREATE INDEX "curriculum_outcomes_key_stage_year_group_idx"
    ON "curriculum_outcomes"("key_stage", "year_group");

CREATE INDEX "curriculum_outcomes_app_topic_id_idx"
    ON "curriculum_outcomes"("app_topic_id");

CREATE INDEX "curriculum_outcomes_coverage_status_idx"
    ON "curriculum_outcomes"("coverage_status");
