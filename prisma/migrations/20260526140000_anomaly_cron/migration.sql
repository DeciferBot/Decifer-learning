-- Migration: Anomaly detection pg_cron job + question_reports table
-- Phase 12 — nightly anomaly detection, flagged regeneration, Report a problem

-- ── question_reports: "Report a problem" submissions from children ────────────
CREATE TABLE IF NOT EXISTS "question_reports" (
  "id"           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  "question_id"  UUID    NOT NULL REFERENCES "quiz_questions"("id") ON DELETE CASCADE,
  "profile_id"   UUID    NOT NULL REFERENCES "profiles"("id")       ON DELETE CASCADE,
  "reason"       TEXT    NOT NULL CHECK (char_length("reason") <= 280),
  "status"       TEXT    NOT NULL DEFAULT 'open'
                         CHECK ("status" IN ('open', 'reviewed', 'dismissed')),
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "question_reports_question_id_idx" ON "question_reports"("question_id");
CREATE INDEX IF NOT EXISTS "question_reports_status_idx"      ON "question_reports"("status");

-- One open report per child per question (prevent spam)
CREATE UNIQUE INDEX IF NOT EXISTS "question_reports_one_open_per_child"
  ON "question_reports"("question_id", "profile_id")
  WHERE "status" = 'open';

-- RLS: children can insert their own reports; only admins can read all
ALTER TABLE "question_reports" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "question_reports_insert_own" ON "question_reports"
  FOR INSERT WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "question_reports_select_admin" ON "question_reports"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── pg_cron: nightly anomaly detection (runs at 02:00 UTC) ───────────────────
-- Requires pg_cron extension (enabled in Supabase by default on Pro plans).
-- Flags questions with:
--   • ≥20 first-attempt answers AND error rate > 60%  → status = 'flagged'
--   • ≥15 attempts AND hint-3 usage rate > 50%        → status = 'flagged'
-- Also flags questions with ≥2 open child reports.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove old job if it exists
    PERFORM cron.unschedule('anomaly-detection')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'anomaly-detection');

    PERFORM cron.schedule(
      'anomaly-detection',
      '0 2 * * *',   -- 02:00 UTC daily
      $$
        -- Flag high-error-rate questions
        UPDATE quiz_questions
        SET status = 'flagged'
        WHERE status = 'published'
          AND id IN (
            SELECT qa.question_id
            FROM quiz_answers qa
            JOIN quiz_attempts att ON att.id = qa.attempt_id
            WHERE att.created_at >= NOW() - INTERVAL '90 days'
            GROUP BY qa.question_id
            HAVING COUNT(*) >= 20
               AND (COUNT(*) FILTER (WHERE NOT qa.was_correct))::FLOAT / COUNT(*) > 0.60
          );

        -- Flag high-hint-3-rate questions
        UPDATE quiz_questions
        SET status = 'flagged'
        WHERE status = 'published'
          AND id IN (
            SELECT qa.question_id
            FROM quiz_answers qa
            JOIN quiz_attempts att ON att.id = qa.attempt_id
            WHERE att.created_at >= NOW() - INTERVAL '90 days'
            GROUP BY qa.question_id
            HAVING COUNT(DISTINCT att.id) >= 15
               AND (COUNT(*) FILTER (WHERE qa.hint_number = 3))::FLOAT / COUNT(DISTINCT att.id) > 0.50
          );

        -- Flag questions with 2+ open child reports
        UPDATE quiz_questions
        SET status = 'flagged'
        WHERE status = 'published'
          AND id IN (
            SELECT question_id
            FROM question_reports
            WHERE status = 'open'
            GROUP BY question_id
            HAVING COUNT(*) >= 2
          );
      $$
    );
  END IF;
END $$;

COMMENT ON TABLE "question_reports" IS 'Child-submitted "Report a problem" flags for quiz questions. Admin-reviewed.';
