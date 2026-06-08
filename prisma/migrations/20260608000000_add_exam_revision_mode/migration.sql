-- Exam Revision Mode: parent-assigned timed cross-topic exams

CREATE TABLE "exam_assignments" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_profile_id"   UUID NOT NULL,
    "child_profile_id"    UUID NOT NULL,
    "subject_id"          UUID NOT NULL,
    "year_group_id"       UUID NOT NULL,
    "title"               TEXT NOT NULL,
    "topic_scope"         TEXT NOT NULL DEFAULT 'all',
    "topic_ids"           JSONB,
    "question_count"      INTEGER NOT NULL DEFAULT 20,
    "time_limit_minutes"  INTEGER NOT NULL DEFAULT 30,
    "hints_allowed"       BOOLEAN NOT NULL DEFAULT false,
    "available_from"      TIMESTAMPTZ,
    "available_until"     TIMESTAMPTZ,
    "status"              TEXT NOT NULL DEFAULT 'active',
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "exam_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "exam_assignments_topic_scope_check"
        CHECK (topic_scope IN ('all', 'weak_areas', 'selected')),
    CONSTRAINT "exam_assignments_status_check"
        CHECK (status IN ('active', 'completed', 'archived'))
);

CREATE INDEX "exam_assignments_child_status_idx"
    ON "exam_assignments"("child_profile_id", "status");
CREATE INDEX "exam_assignments_parent_created_idx"
    ON "exam_assignments"("parent_profile_id", "created_at" DESC);

ALTER TABLE "exam_assignments"
    ADD CONSTRAINT "exam_assignments_parent_profile_id_fkey"
    FOREIGN KEY ("parent_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

ALTER TABLE "exam_assignments"
    ADD CONSTRAINT "exam_assignments_child_profile_id_fkey"
    FOREIGN KEY ("child_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

ALTER TABLE "exam_assignments"
    ADD CONSTRAINT "exam_assignments_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id");

ALTER TABLE "exam_assignments"
    ADD CONSTRAINT "exam_assignments_year_group_id_fkey"
    FOREIGN KEY ("year_group_id") REFERENCES "year_groups"("id");


CREATE TABLE "exam_attempts" (
    "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
    "exam_assignment_id"   UUID NOT NULL,
    "profile_id"           UUID NOT NULL,
    "question_ids"         JSONB NOT NULL,
    "started_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
    "completed_at"         TIMESTAMPTZ,
    "time_taken_seconds"   INTEGER,
    "score"                DOUBLE PRECISION,
    "status"               TEXT NOT NULL DEFAULT 'in_progress',
    "answers"              JSONB,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "exam_attempts_status_check"
        CHECK (status IN ('in_progress', 'completed', 'timed_out', 'abandoned'))
);

CREATE INDEX "exam_attempts_assignment_idx"
    ON "exam_attempts"("exam_assignment_id");
CREATE INDEX "exam_attempts_profile_started_idx"
    ON "exam_attempts"("profile_id", "started_at" DESC);

ALTER TABLE "exam_attempts"
    ADD CONSTRAINT "exam_attempts_exam_assignment_id_fkey"
    FOREIGN KEY ("exam_assignment_id") REFERENCES "exam_assignments"("id") ON DELETE CASCADE;

ALTER TABLE "exam_attempts"
    ADD CONSTRAINT "exam_attempts_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
