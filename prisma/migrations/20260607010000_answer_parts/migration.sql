-- Sprint 3: Multi-part question types
-- answer_parts stores structured data for true_false_grid and ordered_list types.
-- Nullable so all existing MCQ rows are unaffected.

ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS answer_parts JSONB;
