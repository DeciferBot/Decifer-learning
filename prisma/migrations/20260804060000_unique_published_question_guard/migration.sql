-- Guarantee no two PUBLISHED questions are identical.
--
-- Why a database constraint rather than application checks: there are eight
-- separate paths that insert or publish questions (db.write_question,
-- pipeline.fix_staged_question, and six ingest scripts under scripts/).
-- Guarding each in code is fragile and silently misses any path added later.
-- This covers all of them, including future ones.
--
-- The key is question_text + correct_answer + distractors, normalised
-- (lowercased, punctuation stripped, whitespace collapsed). Comparing the
-- question stem ALONE is wrong: "Which sentence uses an apostrophe correctly?"
-- is a legitimate question family whose options differ each time. Keying on the
-- stem over-counted duplicates as 459 when the real figure was 211 during the
-- 2026-07-31 audit, and would have destroyed sound content.
--
-- Partial (status='published' only), so staged/flagged/retired copies are
-- unaffected: a duplicate may exist unpublished, it just cannot go live.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_questions_published_dedup_idx
ON quiz_questions (
  (lower(regexp_replace(regexp_replace(
     question_text || ' ~A~ ' || coalesce(correct_answer, '') ||
     ' ~D~ ' || coalesce(distractors::text, ''),
     '[^a-zA-Z0-9 ]', '', 'g'), '\s+', ' ', 'g')))
)
WHERE status = 'published';

COMMENT ON INDEX quiz_questions_published_dedup_idx IS
  'Blocks publishing a question identical (text+answer+distractors) to one already live. Partial on status=published so unpublished copies are allowed.';
