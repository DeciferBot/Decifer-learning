-- Add quiz_optional flag to topics table.
-- When true: topic has no quiz (Learn-only node on world map, e.g. practical PE/Art topics).
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS quiz_optional BOOLEAN NOT NULL DEFAULT false;
