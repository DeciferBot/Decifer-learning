-- Close the RLS gap on internal/app tables flagged by the Supabase security
-- advisor. Verified none are accessed via the Supabase client (PostgREST) — all
-- access is Prisma / the Python pipeline over a direct connection, which bypasses
-- RLS. Enabling RLS with no policy denies anon/authenticated PostgREST access
-- (the exposure) without affecting the app. Idempotent via IF checks not needed —
-- ENABLE is a no-op if already enabled.
ALTER TABLE public._prisma_migrations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_outcomes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_errors    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_units     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exploration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oak_lesson_cache     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_run_log         ENABLE ROW LEVEL SECURITY;
