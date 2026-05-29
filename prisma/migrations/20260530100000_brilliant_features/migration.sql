-- Brilliant-inspired feature upgrades
-- 1. Pretesting mode on topics
-- 2. Checkpoint quiz type (no schema change needed — reuses quiz_attempts)

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS pedagogy_mode TEXT NOT NULL DEFAULT 'instruction_first';

COMMENT ON COLUMN topics.pedagogy_mode IS
  'instruction_first (default): Learn→Practise→Quiz. '
  'pretest_first: child attempts a question before reading the lesson (Brilliant-style active learning).';
