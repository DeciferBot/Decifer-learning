-- Migration: content_cleanup_rpcs
-- Adds two new anomaly-detection rules:
--   Rule 4: flag questions where any two hints are identical (broken hint progression)
--   Rule 5: flag non-Maths questions that are pure arithmetic word problems

-- Rule 4: Flag questions where any two hints are identical (broken hint progression)
CREATE OR REPLACE FUNCTION flag_hint_duplication_questions()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE flagged_count integer;
BEGIN
  UPDATE quiz_questions SET status = 'flagged'
  WHERE status = 'published'
    AND (
      (hint_1 IS NOT NULL AND hint_2 IS NOT NULL AND hint_1 = hint_2)
      OR (hint_2 IS NOT NULL AND hint_3 IS NOT NULL AND hint_2 = hint_3)
      OR (hint_1 IS NOT NULL AND hint_3 IS NOT NULL AND hint_1 = hint_3)
    );
  GET DIAGNOSTICS flagged_count = ROW_COUNT;
  RETURN flagged_count;
END;
$$;

-- Rule 5: Flag non-Maths questions that are pure arithmetic word problems
-- (e.g. "Romans built 7 forts × 8 = 56" in a History topic)
-- Science calculation questions are EXCLUDED (they belong in Science)
CREATE OR REPLACE FUNCTION flag_subject_mismatch_questions()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE flagged_count integer;
BEGIN
  UPDATE quiz_questions SET status = 'flagged'
  WHERE status = 'published'
    AND topic_id IN (
      SELECT t.id FROM topics t
      JOIN subjects s ON t.subject_id = s.id
      WHERE s.name IN ('History', 'Geography')
    )
    AND (
      question_text ~* 'how many .{0,50}(altogether|in total|each (day|week|month|year))'
      OR question_text ~* '(each|every) .{0,20}had \d+'
      OR question_text ~* 'made \d+ (rows?|groups?|equal groups?)'
      OR question_text ~* 'built \d+ (forts?|temples?|towers?|aqueducts?|theatres?|bath houses?|walls?)'
      OR question_text ~* 'how many (crates?|boxes?|bags?|scrolls?|seats?|statues?|vases?|soldiers?|arches?|rooms?|buckets?|windows?|shields?|columns?|lorry loads?)'
      OR question_text ~* '\d+ (rows? of|groups? of|equal (rows?|groups?|piles?)) .{0,30}\d+'
    );
  GET DIAGNOSTICS flagged_count = ROW_COUNT;
  RETURN flagged_count;
END;
$$;
