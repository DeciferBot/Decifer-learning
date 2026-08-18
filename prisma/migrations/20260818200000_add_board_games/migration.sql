-- Decifer Downtime — 2-player board games (Chess, Checkers, Connect 4,
-- Scrabble) joined by a 6-character invite code. Guest-cookie identity
-- pattern borrowed from Decifer Live (lib/live/server.ts), but the data
-- access pattern is tighter: every read AND write goes through
-- app/api/downtime/games/* (Prisma over DIRECT_URL), and live updates go
-- out over Supabase Realtime BROADCAST (lib/downtime/broadcast.ts) — a
-- pub/sub channel that is independent of table grants/RLS, unlike Decifer
-- Live's client-side `supabase.from('live_games').select(...)`. So unlike
-- live_games, board_games needs NO anon/authenticated SELECT policy at
-- all: the browser never queries this table directly. Same "server-only"
-- posture as live_game_answers.
--
-- `private_host_state` / `private_guest_state` exist only for Scrabble's
-- rack (each player's rack must never be visible to the other) — with the
-- whole table locked down, a player's own rack is returned only by the
-- server route that already knows which side they are.

DO $$ BEGIN
  CREATE TYPE "BoardGameType" AS ENUM ('chess', 'checkers', 'connect4', 'scrabble');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BoardGameStatus" AS ENUM ('waiting', 'active', 'finished');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE "board_games" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_type"           "BoardGameType" NOT NULL,
    "invite_code"         TEXT NOT NULL,
    "status"              "BoardGameStatus" NOT NULL DEFAULT 'waiting',
    "state"               JSONB NOT NULL,
    "private_host_state"  JSONB,
    "private_guest_state" JSONB,
    "turn"                TEXT NOT NULL DEFAULT 'host',
    "winner"              TEXT,
    "host_profile_id"     UUID,
    "host_guest_token"    UUID,
    "host_display_name"   TEXT NOT NULL,
    "guest_profile_id"    UUID,
    "guest_guest_token"   UUID,
    "guest_display_name"  TEXT,
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"          TIMESTAMPTZ NOT NULL,
    "finished_at"         TIMESTAMPTZ,

    CONSTRAINT "board_games_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "board_games_turn_check" CHECK (turn IN ('host', 'guest')),
    CONSTRAINT "board_games_winner_check" CHECK (winner IS NULL OR winner IN ('host', 'guest', 'draw'))
);

CREATE UNIQUE INDEX "board_games_invite_code_key" ON "board_games"("invite_code");
CREATE INDEX "board_games_status_created_idx" ON "board_games"("status", "created_at");
CREATE INDEX "board_games_host_guest_token_idx" ON "board_games"("host_guest_token");
CREATE INDEX "board_games_guest_guest_token_idx" ON "board_games"("guest_guest_token");

ALTER TABLE "board_games"
    ADD CONSTRAINT "board_games_host_profile_id_fkey"
    FOREIGN KEY ("host_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
ALTER TABLE "board_games"
    ADD CONSTRAINT "board_games_guest_profile_id_fkey"
    FOREIGN KEY ("guest_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

-- ---------- RLS ----------
-- RLS enabled with no policies (denies anon/authenticated entirely), plus an
-- explicit REVOKE ALL as defense in depth against Supabase's default
-- per-schema grant (ALTER DEFAULT PRIVILEGES at project setup normally
-- grants new public tables to anon/authenticated — see 20260731090000 for
-- the gap this closed retroactively on live_games; board_games never has
-- that gap open in the first place). TRUNCATE bypasses RLS entirely, which
-- is exactly why REVOKE ALL (not just REVOKE SELECT) is used here.
ALTER TABLE "board_games" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.board_games FROM anon, authenticated;
