-- Sprint 4: source_analysis question type support
-- source_text holds the primary source excerpt shown above the question
-- source_label identifies the source (e.g. "Source A — medieval chronicle, 1350")
-- source_type classifies the source format for rendering hints

ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS source_text  TEXT,
  ADD COLUMN IF NOT EXISTS source_label TEXT,
  ADD COLUMN IF NOT EXISTS source_type  TEXT;
