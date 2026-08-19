-- Decifer Skills Check — free, no-login curriculum diagnostic.
-- Scope: docs/SKILLS_CHECK_SCOPE.md
--
-- A check is a FIXED FORM: 20 published questions, 4 strands x 5 items, with
-- each strand drawing 1 item from the year below, 3 at year and 1 from the year
-- above. The bands are what let 20 answers place a child as working below /
-- within / above their year. Items point at existing `quiz_questions` rows
-- rather than carrying their own text, so CLAUDE.md §16.5 ("no hardcoded
-- content") holds and every item is subject to the same published-only rule as
-- the rest of the product.
--
-- Why fixed form and not adaptive: lib/irt.ts exists but zero questions are
-- calibrated (0 of 8,277 as of 2026-08-19, on 1,084 answers in the product's
-- whole history). Adaptive selection with no calibration data would be noise
-- dressed as personalisation.
--
-- PRIVACY: a taker is anonymous. `skill_check_attempts` is keyed by a random
-- token in a first-party cookie and holds NO personal data at all — no name, no
-- date of birth, no school. `skill_check_leads` holds one thing, the PARENT's
-- email, given knowingly in exchange for the full report. Children's Code and
-- UAE Child Digital Safety Law 26/2025 both sit behind that split, and the split
-- is what makes the 90-day purge of un-converted attempts a clean delete.

DO $$ BEGIN
  CREATE TYPE "SkillCheckFormat" AS ENUM ('strand_sample', 'timed_tables');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Which year group an item was drawn from, RELATIVE to the check's own year.
DO $$ BEGIN
  CREATE TYPE "SkillCheckBand" AS ENUM ('below', 'at', 'above');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SkillCheckWorkingLevel" AS ENUM (
    'below_year', 'towards_year', 'within_year', 'secure_year', 'secure_ready_to_stretch'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- The check definition ----------

CREATE TABLE "skill_checks" (
    "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
    -- URL segment, e.g. 'maths-year-4'. Drives /skills-check/[slug].
    "slug"              TEXT NOT NULL,
    "subject_id"        UUID NOT NULL,
    "year_group_id"     UUID NOT NULL,
    "format"            "SkillCheckFormat" NOT NULL DEFAULT 'strand_sample',
    "item_count"        INTEGER NOT NULL DEFAULT 20,
    -- Only the timed_tables format uses this. The DfE Multiplication Tables
    -- Check allows 6 seconds per question; strand_sample checks are untimed.
    "seconds_per_item"  INTEGER,
    -- A check goes live only after every one of its items has been hand-checked
    -- once (docs/SKILLS_CHECK_SCOPE.md §11). Measured LLM defect rate is ~10%,
    -- and a public unauthenticated test is the worst place to show a broken item.
    "is_published"      BOOLEAN NOT NULL DEFAULT false,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "skill_checks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "skill_checks_item_count_check" CHECK (item_count > 0),
    CONSTRAINT "skill_checks_seconds_check"
        CHECK (seconds_per_item IS NULL OR seconds_per_item > 0)
);

CREATE UNIQUE INDEX "skill_checks_slug_key" ON "skill_checks"("slug");
CREATE UNIQUE INDEX "skill_checks_subject_year_format_key"
    ON "skill_checks"("subject_id", "year_group_id", "format");
CREATE INDEX "skill_checks_published_idx" ON "skill_checks"("is_published");

ALTER TABLE "skill_checks"
    ADD CONSTRAINT "skill_checks_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id");
ALTER TABLE "skill_checks"
    ADD CONSTRAINT "skill_checks_year_group_id_fkey"
    FOREIGN KEY ("year_group_id") REFERENCES "year_groups"("id");

-- ---------- The items ----------

CREATE TABLE "skill_check_items" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "check_id"        UUID NOT NULL,
    "question_id"     UUID NOT NULL,
    "position"        INTEGER NOT NULL,
    "band"            "SkillCheckBand" NOT NULL,
    -- The strand the result is grouped by. This is the AT-YEAR topic the item
    -- reports under, which is not always the topic the question itself belongs
    -- to: a 'below' item comes from last year's topic but reports under this
    -- year's strand, otherwise the report would list a year the parent did not
    -- ask about.
    "strand_topic_id" UUID NOT NULL,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "skill_check_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "skill_check_items_position_check" CHECK (position >= 0)
);

CREATE UNIQUE INDEX "skill_check_items_check_position_key"
    ON "skill_check_items"("check_id", "position");
-- No question appears twice in the same check.
CREATE UNIQUE INDEX "skill_check_items_check_question_key"
    ON "skill_check_items"("check_id", "question_id");
CREATE INDEX "skill_check_items_strand_idx" ON "skill_check_items"("strand_topic_id");

ALTER TABLE "skill_check_items"
    ADD CONSTRAINT "skill_check_items_check_id_fkey"
    FOREIGN KEY ("check_id") REFERENCES "skill_checks"("id") ON DELETE CASCADE;
ALTER TABLE "skill_check_items"
    ADD CONSTRAINT "skill_check_items_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE RESTRICT;
ALTER TABLE "skill_check_items"
    ADD CONSTRAINT "skill_check_items_strand_topic_id_fkey"
    FOREIGN KEY ("strand_topic_id") REFERENCES "topics"("id");

-- ---------- Attempts (anonymous) ----------

CREATE TABLE "skill_check_attempts" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    -- Random, unguessable, and the ONLY handle on an attempt. Stored in a
    -- first-party cookie and used in the result URL. Not derived from anything
    -- about the child.
    "token"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "check_id"       UUID NOT NULL,
    "started_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    "finished_at"    TIMESTAMPTZ,
    "raw_score"      INTEGER,
    "total_items"    INTEGER,
    "working_level"  "SkillCheckWorkingLevel",
    -- Per-strand results, exactly as lib/skills-check/score.ts returns them.
    -- Denormalised on purpose: the report must still render years later even if
    -- a topic is renamed or a question is retired.
    "strand_results" JSONB,
    -- Set only if a logged-in profile took it. Null for the public funnel, which
    -- is the whole point of the funnel.
    "profile_id"     UUID,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "skill_check_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skill_check_attempts_token_key" ON "skill_check_attempts"("token");
CREATE INDEX "skill_check_attempts_check_idx" ON "skill_check_attempts"("check_id", "created_at");
-- Drives the 90-day purge of attempts that never became a lead.
CREATE INDEX "skill_check_attempts_created_idx" ON "skill_check_attempts"("created_at");

ALTER TABLE "skill_check_attempts"
    ADD CONSTRAINT "skill_check_attempts_check_id_fkey"
    FOREIGN KEY ("check_id") REFERENCES "skill_checks"("id");
ALTER TABLE "skill_check_attempts"
    ADD CONSTRAINT "skill_check_attempts_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

-- ---------- Answers (kept for calibration, not for the child's record) ----------
-- These are what will eventually calibrate lib/irt.ts, which has never had data.
-- They deliberately do NOT write into session_answers / quiz_answers: a check
-- taken by an anonymous visitor must not touch a child's learning record.

CREATE TABLE "skill_check_answers" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id"   UUID NOT NULL,
    "item_id"      UUID NOT NULL,
    "child_answer" TEXT,
    "was_correct"  BOOLEAN NOT NULL,
    "time_seconds" INTEGER,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "skill_check_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skill_check_answers_attempt_item_key"
    ON "skill_check_answers"("attempt_id", "item_id");

ALTER TABLE "skill_check_answers"
    ADD CONSTRAINT "skill_check_answers_attempt_id_fkey"
    FOREIGN KEY ("attempt_id") REFERENCES "skill_check_attempts"("id") ON DELETE CASCADE;
ALTER TABLE "skill_check_answers"
    ADD CONSTRAINT "skill_check_answers_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "skill_check_items"("id") ON DELETE CASCADE;

-- ---------- Leads (the parent's email, and nothing else) ----------

CREATE TABLE "skill_check_leads" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id"   UUID NOT NULL,
    "parent_email" TEXT NOT NULL,
    "consented_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "verified_at"  TIMESTAMPTZ,
    -- Set when the parent uses the one-click delete link in the report email.
    -- Kept as a tombstone rather than a hard delete so a deleted address is not
    -- re-emailed by a later cron.
    "deleted_at"   TIMESTAMPTZ,
    "source"       TEXT,
    "utm"          JSONB,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "skill_check_leads_pkey" PRIMARY KEY ("id")
);

-- One lead per attempt: re-submitting the same email is an update, not a row.
CREATE UNIQUE INDEX "skill_check_leads_attempt_key" ON "skill_check_leads"("attempt_id");
CREATE INDEX "skill_check_leads_email_idx" ON "skill_check_leads"("parent_email");

ALTER TABLE "skill_check_leads"
    ADD CONSTRAINT "skill_check_leads_attempt_id_fkey"
    FOREIGN KEY ("attempt_id") REFERENCES "skill_check_attempts"("id") ON DELETE CASCADE;

-- ---------- RLS ----------
-- Same server-only posture as board_games (20260818200000): RLS on with NO
-- policies denies anon/authenticated outright, and an explicit REVOKE ALL
-- closes Supabase's default per-schema grant as defence in depth. TRUNCATE
-- bypasses RLS entirely, which is why this is REVOKE ALL and not REVOKE SELECT.
--
-- Every read and write goes through app/api/skills-check/* over Prisma. The
-- browser never queries these tables. That matters most for skill_check_leads,
-- which holds parents' email addresses, and for skill_check_items, whose
-- correct answers must never be readable by the page taking the check.
ALTER TABLE "skill_checks"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_check_items"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_check_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_check_answers"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_check_leads"    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.skill_checks         FROM anon, authenticated;
REVOKE ALL ON public.skill_check_items    FROM anon, authenticated;
REVOKE ALL ON public.skill_check_attempts FROM anon, authenticated;
REVOKE ALL ON public.skill_check_answers  FROM anon, authenticated;
REVOKE ALL ON public.skill_check_leads    FROM anon, authenticated;
