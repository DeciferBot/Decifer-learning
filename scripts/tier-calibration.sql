-- Tier Calibration Query
-- Detects miscalibrated questions based on session_answers data.
-- Run nightly via pg_cron or manually via the admin calibration page.
--
-- Flags:
--   too_hard : ≥20 answers and wrong_rate > 0.80 (question may need easier tier or rewrite)
--   too_easy : ≥20 answers and wrong_rate < 0.10 (question may need harder tier)

SELECT
  qq.id                                                        AS question_id,
  qq.question_text,
  qq.tier,
  ROUND(
    (COUNT(*) FILTER (WHERE NOT sa.was_correct))::NUMERIC
    / COUNT(*)::NUMERIC,
    4
  )                                                            AS wrong_rate,
  CASE
    WHEN (COUNT(*) FILTER (WHERE NOT sa.was_correct))::NUMERIC / COUNT(*) > 0.80
      THEN 'too_hard'
    WHEN (COUNT(*) FILTER (WHERE NOT sa.was_correct))::NUMERIC / COUNT(*) < 0.10
      THEN 'too_easy'
  END                                                          AS flag_type,
  t.title                                                      AS topic_title,
  s.name                                                       AS subject,
  yg.label                                                     AS year_group
FROM session_answers sa
JOIN quiz_questions  qq ON qq.id  = sa.question_id
JOIN topics          t  ON t.id   = qq.topic_id
JOIN subjects        s  ON s.id   = t.subject_id
JOIN year_groups     yg ON yg.id  = t.year_group_id
GROUP BY
  qq.id, qq.question_text, qq.tier,
  t.title, s.name, yg.label
HAVING
  COUNT(*) >= 20
  AND (
    (COUNT(*) FILTER (WHERE NOT sa.was_correct))::NUMERIC / COUNT(*) > 0.80
    OR
    (COUNT(*) FILTER (WHERE NOT sa.was_correct))::NUMERIC / COUNT(*) < 0.10
  )
ORDER BY
  wrong_rate DESC;
