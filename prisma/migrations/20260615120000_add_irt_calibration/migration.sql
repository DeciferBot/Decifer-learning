-- IRT / Rasch difficulty calibration columns for quiz_questions.
-- Additive and nullable: backward-compatible with all existing reads/writes.
-- Populated nightly by /api/cron/calibrate-difficulty (see lib/irt.ts).

ALTER TABLE "quiz_questions"
  ADD COLUMN IF NOT EXISTS "difficulty_b"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "calibration_n" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "calibrated_at" TIMESTAMP(3);

-- Partial index for the admin "needs re-tiering" / calibration-coverage views.
CREATE INDEX IF NOT EXISTS "quiz_questions_difficulty_b_idx"
  ON "quiz_questions" ("difficulty_b")
  WHERE "difficulty_b" IS NOT NULL;
