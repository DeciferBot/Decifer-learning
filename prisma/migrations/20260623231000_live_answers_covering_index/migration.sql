-- Covering index for the end-of-game points aggregation:
-- SELECT player_id, COUNT(*) WHERE game_id = X AND was_correct = true
CREATE INDEX IF NOT EXISTS live_game_answers_game_correct_idx ON live_game_answers(game_id, was_correct);
