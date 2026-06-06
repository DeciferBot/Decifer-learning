-- Sprint 1: Exam Technique Layer
-- Adds technique_type, technique_hint, technique_note to quiz_questions.
-- All nullable so existing rows are unaffected; the pipeline populates them for
-- newly generated questions. Old questions can be backfilled via regeneration.

ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS technique_type  TEXT,
  ADD COLUMN IF NOT EXISTS technique_hint  TEXT,
  ADD COLUMN IF NOT EXISTS technique_note  TEXT;

-- Partial index to quickly find questions that still need technique fields
-- (used by future backfill script).
CREATE INDEX IF NOT EXISTS idx_quiz_questions_missing_technique
  ON quiz_questions (topic_id, status)
  WHERE technique_type IS NULL AND status = 'published';
