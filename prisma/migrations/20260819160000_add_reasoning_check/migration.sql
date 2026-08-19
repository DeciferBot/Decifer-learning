-- Decifer Reasoning Check — free, no-login non-verbal reasoning test.
-- Scope: docs/REASONING_TEST_SCOPE.md
--
-- THE ONE THING THAT MAKES THIS SCHEMA SMALL: an item is a SEED, not a row.
-- Every question is produced by lib/reasoning/generate.ts from (type, level,
-- seed), deterministically. So there is no content table here, nothing to
-- moderate, nothing to hand-check, and the correct answer never leaves the
-- server — marking regenerates the item and compares. A bug report is the seed.
--
-- That is also why `skill_check_items` is NOT reused: its `question_id` is a
-- required foreign key to `quiz_questions`, and a generated item has no row to
-- point at.
--
-- PRIVACY, same posture as the Skills Check: an attempt holds NO personal data
-- at all — no name, no date of birth, no school. `age_band` is a band and is
-- stored only so a like-for-like comparison becomes possible later (scope §9);
-- it does not change the test. The single personal field in the whole feature is
-- the PARENT's email in `reasoning_leads`, given knowingly for the report.
-- Children's Code and UAE Child Digital Safety Law 26/2025 sit behind that split.

DO $$ BEGIN
  CREATE TYPE "ReasoningItemType" AS ENUM ('sequence', 'matrix', 'analogy', 'odd_one_out');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- A band, deliberately coarse. Never a date of birth.
DO $$ BEGIN
  CREATE TYPE "ReasoningAgeBand" AS ENUM ('year_3_4', 'year_5_6', 'year_7_8', 'not_said');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- Attempts (anonymous) ----------

CREATE TABLE "reasoning_attempts" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    -- Random, unguessable, and the ONLY handle on an attempt. Also the seed
    -- every item in the paper is derived from.
    "token"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "age_band"      "ReasoningAgeBand" NOT NULL DEFAULT 'not_said',
    "started_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    "finished_at"   TIMESTAMPTZ,
    "total_items"   INTEGER,
    "raw_score"     INTEGER,
    -- Highest level solved in at least two different item types. 0 means there
    -- was not enough evidence to name one. NEVER an IQ, a percentile or any
    -- standardised score — see lib/reasoning/score.ts.
    "level_reached" INTEGER,
    -- Per-type results exactly as lib/reasoning/score.ts returns them.
    -- Denormalised so an old report still renders after a generator changes.
    "type_results"  JSONB,
    -- Set only when a logged-in profile took it. Null for the public funnel,
    -- which is the whole point of the funnel.
    "profile_id"    UUID,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "reasoning_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reasoning_attempts_level_check"
        CHECK (level_reached IS NULL OR (level_reached >= 0 AND level_reached <= 6))
);

CREATE UNIQUE INDEX "reasoning_attempts_token_key" ON "reasoning_attempts"("token");
-- Drives the purge of attempts that never became a lead, and the Phase E norms.
CREATE INDEX "reasoning_attempts_created_idx" ON "reasoning_attempts"("created_at");
CREATE INDEX "reasoning_attempts_band_idx" ON "reasoning_attempts"("age_band", "finished_at");

ALTER TABLE "reasoning_attempts"
    ADD CONSTRAINT "reasoning_attempts_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

-- ---------- Answers ----------
-- (type, level, seed) is the whole question. Storing those three means a past
-- paper can be rebuilt exactly, which is how a report renders with no content
-- table and how a "this question was wrong" report is reproduced.

CREATE TABLE "reasoning_answers" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id"   UUID NOT NULL,
    "position"     INTEGER NOT NULL,
    "item_type"    "ReasoningItemType" NOT NULL,
    "level"        INTEGER NOT NULL,
    "seed"         TEXT NOT NULL,
    -- Index into the option list the child was shown. Null when they skipped.
    "chosen_index" INTEGER,
    "was_correct"  BOOLEAN NOT NULL,
    -- Milliseconds, not seconds. Speed is half of what these tests measure and
    -- a whole second is too coarse to see a difference between item types.
    "time_ms"      INTEGER,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "reasoning_answers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reasoning_answers_position_check" CHECK (position >= 0),
    CONSTRAINT "reasoning_answers_level_check" CHECK (level >= 1 AND level <= 6),
    CONSTRAINT "reasoning_answers_time_check" CHECK (time_ms IS NULL OR time_ms >= 0)
);

-- One answer per position. This is what makes the answer endpoint idempotent:
-- a double-tap or a retried request cannot write a second answer or move the
-- ladder twice.
CREATE UNIQUE INDEX "reasoning_answers_attempt_position_key"
    ON "reasoning_answers"("attempt_id", "position");

ALTER TABLE "reasoning_answers"
    ADD CONSTRAINT "reasoning_answers_attempt_id_fkey"
    FOREIGN KEY ("attempt_id") REFERENCES "reasoning_attempts"("id") ON DELETE CASCADE;

-- ---------- Leads (the parent's email, and nothing else) ----------

CREATE TABLE "reasoning_leads" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id"   UUID NOT NULL,
    "parent_email" TEXT NOT NULL,
    "consented_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "verified_at"  TIMESTAMPTZ,
    -- Set by the one-click delete link in the report email. A tombstone rather
    -- than a hard delete, so a deleted address is never re-emailed by a cron.
    "deleted_at"   TIMESTAMPTZ,
    "source"       TEXT,
    "utm"          JSONB,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "reasoning_leads_pkey" PRIMARY KEY ("id")
);

-- One lead per attempt: re-submitting the same email is an update, not a row.
CREATE UNIQUE INDEX "reasoning_leads_attempt_key" ON "reasoning_leads"("attempt_id");
CREATE INDEX "reasoning_leads_email_idx" ON "reasoning_leads"("parent_email");

ALTER TABLE "reasoning_leads"
    ADD CONSTRAINT "reasoning_leads_attempt_id_fkey"
    FOREIGN KEY ("attempt_id") REFERENCES "reasoning_attempts"("id") ON DELETE CASCADE;

-- ---------- RLS ----------
-- Same server-only posture as skill_checks (20260819100000) and board_games
-- (20260818200000): RLS on with NO policies denies anon and authenticated
-- outright, and an explicit REVOKE ALL closes Supabase's default per-schema
-- grant as defence in depth. TRUNCATE bypasses RLS entirely, which is why this
-- is REVOKE ALL and not REVOKE SELECT.
--
-- Every read and write goes through app/api/reasoning/* over Prisma. The browser
-- never queries these tables. It matters most for reasoning_leads, which holds
-- parents' email addresses, and for reasoning_answers, whose seeds would let
-- anyone regenerate a live paper and read its answers off the page.
ALTER TABLE "reasoning_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reasoning_answers"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reasoning_leads"    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reasoning_attempts FROM anon, authenticated;
REVOKE ALL ON public.reasoning_answers  FROM anon, authenticated;
REVOKE ALL ON public.reasoning_leads    FROM anon, authenticated;
