-- Restrict anon/authenticated reads on the live (Blitz) tables to safe columns.
--
-- WHY: live_games and live_game_players both carry RLS policies of `USING (true)`
-- for anon, because the lobby has to be readable by guests who are not logged in.
-- But the tables also hold:
--   live_games.host_guest_token   -- compared in lib/live/server.ts to authorise
--                                    host-only actions, so reading it is a full
--                                    host takeover of any game
--   live_games.host_email         -- PII (guest hosts sign up with email only)
--   live_game_players.guest_token -- same, for impersonating a player
--
-- A table-level SELECT grant covers every column, so the RLS policy alone cannot
-- hide them. In PostgreSQL, column privileges do not subtract from a table-level
-- grant: the table grant must be revoked and the safe columns granted explicitly.
--
-- The client no longer needs these columns either: lib/live/useLiveGame.ts now
-- selects an explicit list instead of '*'. Server paths (Prisma over DIRECT_URL,
-- and service_role) are unaffected by anon/authenticated grants.

REVOKE SELECT ON public.live_games FROM anon, authenticated;
GRANT SELECT (
  id, pin, host_profile_id, status, mode, topic_id, subject_id, year_group_id,
  question_ids, question_count, seconds_per_question, current_index,
  current_started_at, created_at, finished_at
) ON public.live_games TO anon, authenticated;

REVOKE SELECT ON public.live_game_players FROM anon, authenticated;
GRANT SELECT (
  id, game_id, profile_id, display_name, avatar_config, score, streak,
  is_host, joined_at, last_seen, is_guest
) ON public.live_game_players TO anon, authenticated;

-- TRUNCATE is the one table privilege RLS cannot police: it ignores row policies
-- entirely. Nothing reaches the database as anon/authenticated except PostgREST,
-- which never issues TRUNCATE, so removing it costs nothing and closes the gap.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM anon, authenticated', t.relname);
  END LOOP;
END $$;
