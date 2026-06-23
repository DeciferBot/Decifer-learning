-- Allow live games to be hosted without a Decifer account.
-- host_profile_id becomes nullable; host_email + host_guest_token are added
-- so anonymous hosts can authenticate via their httpOnly cookie.

ALTER TABLE live_games ALTER COLUMN host_profile_id DROP NOT NULL;
ALTER TABLE live_games ADD COLUMN IF NOT EXISTS host_email TEXT;
ALTER TABLE live_games ADD COLUMN IF NOT EXISTS host_guest_token UUID;
CREATE INDEX IF NOT EXISTS live_games_host_guest_token_idx ON live_games(host_guest_token) WHERE host_guest_token IS NOT NULL;
