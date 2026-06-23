-- Decifer Live — guest players (Kahoot-style: join with a nickname, no account).
-- Make profile_id nullable, add a per-browser guest token, and open the SELECT
-- policies to the anon role so logged-out players' devices can subscribe to
-- Realtime. Writes still go only through server routes (service role).

ALTER TABLE "live_game_players" ALTER COLUMN "profile_id" DROP NOT NULL;
ALTER TABLE "live_game_players" ADD COLUMN IF NOT EXISTS "guest_token" UUID;
ALTER TABLE "live_game_players" ADD COLUMN IF NOT EXISTS "is_guest" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "live_game_players_game_guest_key"
  ON "live_game_players"("game_id", "guest_token");

-- Allow anon (logged-out) clients to read game state + scoreboard for Realtime.
DROP POLICY IF EXISTS "live_games_select_authenticated" ON "live_games";
DROP POLICY IF EXISTS "live_game_players_select_authenticated" ON "live_game_players";

CREATE POLICY "live_games_select_public"
  ON "live_games" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "live_game_players_select_public"
  ON "live_game_players" FOR SELECT TO anon, authenticated USING (true);
