-- Add worked_example column to quiz_questions
-- Stores a step-by-step solution of a similar (not identical) problem,
-- shown to children before they attempt a new question type.
ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS worked_example TEXT;

COMMENT ON COLUMN quiz_questions.worked_example IS
  'Step-by-step solution of a SIMILAR (not the same) problem. '
  'Shown as "Show me how →" on the first question of each question_type in a quiz session. '
  'g=0.48 learning effect (Barbieri et al. 2023 meta-analysis).';
