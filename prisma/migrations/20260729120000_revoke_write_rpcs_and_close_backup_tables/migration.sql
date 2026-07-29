-- Close two holes that were reachable with nothing but the public anon key.
--
-- 1. Six content-mutating RPCs were EXECUTE-able by anon and authenticated.
--    Five flag questions (status='flagged', pulling them out of circulation) and
--    promote_qualified_staged_questions publishes staged questions to children.
--    Anyone could POST /rest/v1/rpc/<name> and move content in or out of the
--    child-facing pool. The Supabase advisor only flagged three of them, because
--    it looks for SECURITY DEFINER; the other three are just as callable.
--
--    The only legitimate callers are the nightly cron and the admin page, and
--    both were using the anon key. They now use the service-role client
--    (createSupabaseAdminClient), which bypasses these grants entirely, so this
--    revoke does not break anomaly detection or auto-promotion.
--
-- 2. Six leftover backup tables from the 2026-06-23 cleanups had RLS disabled and
--    were therefore served by PostgREST. quiz_questions_dedup_backup_20260623
--    alone exposed 4,081 questions with correct_answer, all three hints and the
--    explanation. Verified readable with the public anon key before this change.
--
--    Enabling RLS with no policy denies anon and authenticated while leaving the
--    data intact and reachable by service_role, which is what a backup is for.
--    Deliberately NOT dropping them: they are the rollback for the dedup and
--    mismatch cleanups, and they cost ~3.5 MB in total.
--
-- current_user_is_admin() is deliberately left alone. It is STABLE and
-- read-only, it returns false for anon, and it is called inside the
-- profiles_select and family_links_select RLS policies. Policies are evaluated
-- as the calling role, so revoking EXECUTE from authenticated would break
-- profile reads for every signed-in user.

REVOKE EXECUTE ON FUNCTION public.flag_high_error_rate_questions()      FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.flag_high_hint_rate_questions()       FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.flag_missing_visual_questions()       FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.flag_hint_duplication_questions()     FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.flag_subject_mismatch_questions()     FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_qualified_staged_questions()  FROM anon, authenticated, PUBLIC;

ALTER TABLE public.curriculum_units_bkp_split_20260623     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_units_bkp_reingest_20260623  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_units_bkp_mismatch_20260623  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learn_content_bkp_mismatch_20260623     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions_dedup_backup_20260623    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_rebuild_done                       ENABLE ROW LEVEL SECURITY;
