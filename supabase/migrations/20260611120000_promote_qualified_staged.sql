-- Nightly auto-promotion: staged questions that pass every gate get published.
-- Gates: score >= 85, not subject-contaminated, distinct hints, no visual ref
-- without an image, and either RAG-grounded or a code-verified question type.
CREATE OR REPLACE FUNCTION promote_qualified_staged_questions()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE promoted_count integer;
BEGIN
  UPDATE quiz_questions SET status = 'published'
  WHERE id IN (
    SELECT qq.id FROM quiz_questions qq
    JOIN topics t ON qq.topic_id = t.id
    JOIN subjects s ON t.subject_id = s.id
    WHERE qq.status = 'staged'
      AND qq.confidence_score >= 85
      AND NOT (s.name IN ('History','Geography') AND qq.question_type LIKE 'maths_%')
      AND qq.hint_1 IS DISTINCT FROM qq.hint_2
      AND qq.hint_2 IS DISTINCT FROM qq.hint_3
      AND qq.hint_1 IS DISTINCT FROM qq.hint_3
      AND NOT (
        qq.question_text ~* '(this|the) (graph|diagram|picture|image|chart|table below|figure)'
        AND (qq.foundation_images IS NULL OR qq.foundation_images = 'null'::jsonb
             OR jsonb_array_length(COALESCE(qq.foundation_images,'[]'::jsonb)) = 0)
      )
      AND (
        (qq.source_chunk_ids IS NOT NULL AND jsonb_array_length(qq.source_chunk_ids) > 0)
        OR qq.question_type IN ('maths_arithmetic','maths_algebra','maths_geometry',
                                'science_physics_calculation','science_chemistry_equation',
                                'chemistry_element_fact','english_grammar')
      )
  );
  GET DIAGNOSTICS promoted_count = ROW_COUNT;
  RETURN promoted_count;
END;
$$;
