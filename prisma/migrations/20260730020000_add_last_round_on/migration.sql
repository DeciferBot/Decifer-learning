-- Separate "opened the app" from "did a round".
--
-- The streak used to advance from profiles.last_active, which /api/streak/check
-- wrote on every home-screen mount. So a child could open the app, tap nothing,
-- close it, and keep their streak. That makes the streak meaningless, and it is
-- the mechanic the whole retention loop hangs off.
--
-- last_active keeps its existing meaning and its existing readers (the admin
-- activity counts, the engagement funnel, the comeback nudge). last_round_on is
-- new and is the only thing the streak reads.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_round_on DATE;

COMMENT ON COLUMN profiles.last_round_on IS
  'Last UTC calendar day the child completed a round (quiz attempt or daily challenge). Drives streak_days. See lib/streak.ts.';

-- Backfill from real activity so no existing streak is wrongly reset on the next
-- round. Takes the later of the child's last quiz attempt and their last daily
-- challenge, which is exactly what the new column would have recorded.
UPDATE profiles p
SET last_round_on = a.last_day
FROM (
  SELECT profile_id, MAX(day) AS last_day
  FROM (
    SELECT profile_id, (created_at AT TIME ZONE 'UTC')::date AS day
    FROM quiz_attempts
    UNION ALL
    SELECT profile_id, (created_at AT TIME ZONE 'UTC')::date AS day
    FROM point_events
    WHERE reason LIKE 'daily_challenge:%'
  ) rounds
  GROUP BY profile_id
) a
WHERE p.id = a.profile_id
  AND p.last_round_on IS NULL;
