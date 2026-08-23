-- Decifer Downtime — per-player history of finished games. One row per
-- logged-in player per finished game (guests are never recorded; the
-- game-over card invites them to register instead). Written by
-- POST /api/downtime/results and read server-side for the "Your recent
-- games" list on /downtime.
--
-- Same server-only posture as board_games: RLS enabled with no policies and
-- an explicit REVOKE ALL, because the browser never queries this table
-- directly — every read and write goes through app code over Prisma.
-- game_type uses the shared catalogue ids from lib/games/catalogue.ts
-- (TEXT + CHECK rather than the BoardGameType enum, which has no crossword
-- or word-tiles and spells connect4 differently).

CREATE TABLE "downtime_results" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "game_type"  TEXT NOT NULL,
    "mode"       TEXT NOT NULL,
    "difficulty" TEXT,
    "outcome"    TEXT NOT NULL,
    "score"      INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "downtime_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "downtime_results_game_type_check"
        CHECK (game_type IN ('chess', 'checkers', 'connect-4', 'crossword', 'word-tiles')),
    CONSTRAINT "downtime_results_mode_check"
        CHECK (mode IN ('computer', 'friend', 'solo')),
    CONSTRAINT "downtime_results_difficulty_check"
        CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
    CONSTRAINT "downtime_results_outcome_check"
        CHECK (outcome IN ('win', 'loss', 'draw')),
    CONSTRAINT "downtime_results_score_check"
        CHECK (score IS NULL OR (score >= 0 AND score <= 100000))
);

CREATE INDEX "downtime_results_profile_id_created_at_idx"
    ON "downtime_results"("profile_id", "created_at");

ALTER TABLE "downtime_results"
    ADD CONSTRAINT "downtime_results_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

-- ---------- RLS ----------
ALTER TABLE "downtime_results" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.downtime_results FROM anon, authenticated;
