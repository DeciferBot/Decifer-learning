-- Decifer Live — Kahoot-style live multiplayer (CLAUDE.md §11 deferred feature).
-- Purely additive: 3 new tables + 1 enum. PIN-gated, authenticated child
-- profiles only; display-names only; no chat; no public/global leaderboard
-- (UK Children's Code). Writes happen exclusively via server routes using the
-- service role (bypasses RLS); the browser client only SELECTs for the Realtime
-- subscription, so authenticated SELECT policies are added and the tables are
-- registered with the supabase_realtime publication.

-- ---------- Enum ----------
DO $$ BEGIN
  CREATE TYPE "LiveGameStatus" AS ENUM ('lobby', 'in_progress', 'finished');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- live_games ----------
CREATE TABLE "live_games" (
    "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
    "pin"                  TEXT NOT NULL,
    "host_profile_id"      UUID NOT NULL,
    "status"               "LiveGameStatus" NOT NULL DEFAULT 'lobby',
    "mode"                 TEXT NOT NULL DEFAULT 'topic',
    "topic_id"             UUID,
    "subject_id"           UUID,
    "year_group_id"        UUID,
    "question_ids"         JSONB NOT NULL,
    "question_count"       INTEGER NOT NULL DEFAULT 10,
    "seconds_per_question" INTEGER NOT NULL DEFAULT 20,
    "current_index"        INTEGER NOT NULL DEFAULT -1,
    "current_started_at"   TIMESTAMPTZ,
    "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
    "finished_at"          TIMESTAMPTZ,

    CONSTRAINT "live_games_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "live_games_mode_check" CHECK (mode IN ('topic', 'subject'))
);

CREATE UNIQUE INDEX "live_games_pin_key" ON "live_games"("pin");
CREATE INDEX "live_games_status_created_idx" ON "live_games"("status", "created_at");

ALTER TABLE "live_games"
    ADD CONSTRAINT "live_games_host_profile_id_fkey"
    FOREIGN KEY ("host_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

-- ---------- live_game_players ----------
CREATE TABLE "live_game_players" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id"       UUID NOT NULL,
    "profile_id"    UUID NOT NULL,
    "display_name"  TEXT NOT NULL,
    "avatar_config" JSONB,
    "score"         INTEGER NOT NULL DEFAULT 0,
    "streak"        INTEGER NOT NULL DEFAULT 0,
    "is_host"       BOOLEAN NOT NULL DEFAULT false,
    "joined_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    "last_seen"     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "live_game_players_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "live_game_players_game_profile_key" ON "live_game_players"("game_id", "profile_id");
CREATE INDEX "live_game_players_game_score_idx" ON "live_game_players"("game_id", "score" DESC);

ALTER TABLE "live_game_players"
    ADD CONSTRAINT "live_game_players_game_id_fkey"
    FOREIGN KEY ("game_id") REFERENCES "live_games"("id") ON DELETE CASCADE;
ALTER TABLE "live_game_players"
    ADD CONSTRAINT "live_game_players_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

-- ---------- live_game_answers ----------
CREATE TABLE "live_game_answers" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id"        UUID NOT NULL,
    "player_id"      UUID NOT NULL,
    "question_index" INTEGER NOT NULL,
    "question_id"    UUID NOT NULL,
    "answer"         TEXT NOT NULL,
    "was_correct"    BOOLEAN NOT NULL,
    "ms_taken"       INTEGER NOT NULL,
    "points_awarded" INTEGER NOT NULL,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "live_game_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "live_game_answers_player_qindex_key" ON "live_game_answers"("player_id", "question_index");
CREATE INDEX "live_game_answers_game_qindex_idx" ON "live_game_answers"("game_id", "question_index");

ALTER TABLE "live_game_answers"
    ADD CONSTRAINT "live_game_answers_game_id_fkey"
    FOREIGN KEY ("game_id") REFERENCES "live_games"("id") ON DELETE CASCADE;
ALTER TABLE "live_game_answers"
    ADD CONSTRAINT "live_game_answers_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "live_game_players"("id") ON DELETE CASCADE;

-- ---------- RLS ----------
-- Reads: any authenticated user may read game state + the player scoreboard so
-- the Realtime subscription works. These rows hold no PII beyond a display name
-- and a score, and a game is only discoverable via its 6-digit PIN. Answers are
-- NOT readable by the client (server-only) to prevent answer-peeking.
-- Writes: no policy => PostgREST/anon/authenticated cannot write. All mutations
-- go through server routes on the service-role key, which bypasses RLS.
ALTER TABLE "live_games"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "live_game_players" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "live_game_answers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_games_select_authenticated"
    ON "live_games" FOR SELECT TO authenticated USING (true);
CREATE POLICY "live_game_players_select_authenticated"
    ON "live_game_players" FOR SELECT TO authenticated USING (true);
-- (no SELECT policy on live_game_answers — server-only)

-- ---------- Realtime publication ----------
-- Register the two client-readable tables for Postgres Changes streaming.
-- Idempotent: only add when not already a member of the publication.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "live_games";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_game_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "live_game_players";
  END IF;
END $$;
