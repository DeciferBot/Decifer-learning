-- Security hardening (Supabase advisor WARNs), verified non-breaking.
-- Pin search_path on the anomaly/promotion functions (they use unqualified
-- names, so pin to public,pg_temp rather than '').
ALTER FUNCTION public.flag_high_error_rate_questions()      SET search_path = public, pg_temp;
ALTER FUNCTION public.flag_high_hint_rate_questions()       SET search_path = public, pg_temp;
ALTER FUNCTION public.flag_missing_visual_questions()       SET search_path = public, pg_temp;
ALTER FUNCTION public.flag_hint_duplication_questions()     SET search_path = public, pg_temp;
ALTER FUNCTION public.flag_subject_mismatch_questions()     SET search_path = public, pg_temp;
ALTER FUNCTION public.promote_qualified_staged_questions()  SET search_path = public, pg_temp;
-- Close the exposed /rpc endpoint for the signup trigger (triggers fire
-- regardless of caller EXECUTE, so signup is unaffected).
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated, PUBLIC;
