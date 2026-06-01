-- First-run onboarding + non-PII personalisation.
-- Additive only: two nullable columns on profiles. No data rewrite.
--
-- onboarded_at:     timestamp set once the child has seen the avatar + about-me
--                   prompt (completed OR skipped), so they are never re-prompted.
-- learning_profile: JSONB of non-identifying preference answers
--                   (favourite_subject, interests[], learn_styles[], confidence{}).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarded_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS learning_profile JSONB;
