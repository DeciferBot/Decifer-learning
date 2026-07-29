-- Pooled difficulty priors for adaptive question selection.
--
-- Item-level IRT calibration (quiz_questions.difficulty_b) requires 20
-- first-attempt responses per question. The catalogue holds 6,971 published
-- questions against roughly a thousand answers in total, so not one item has
-- ever calibrated. Pooling responses by (question_type, tier) yields a prior
-- that every item in the group can inherit until it earns its own estimate.
--
-- question_type '*' holds the coarser tier-only fallback.
--
-- Contains no personal data: difficulty metadata only, keyed by question type
-- and tier. RLS is still enabled with an explicit read policy so the table is
-- never open by default.

CREATE TABLE IF NOT EXISTS question_difficulty_priors (
  question_type TEXT             NOT NULL,
  tier          TEXT             NOT NULL,
  difficulty_b  DOUBLE PRECISION NOT NULL,
  sample_n      INTEGER          NOT NULL,
  updated_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
  PRIMARY KEY (question_type, tier)
);

ALTER TABLE question_difficulty_priors ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in user: adaptive selection runs as the child's own
-- session. Writes are left to the service role / migration owner, which bypasses
-- RLS, so no INSERT or UPDATE policy is granted to anyone else.
DROP POLICY IF EXISTS question_difficulty_priors_select ON question_difficulty_priors;
CREATE POLICY question_difficulty_priors_select
  ON question_difficulty_priors
  FOR SELECT
  TO authenticated
  USING (true);
