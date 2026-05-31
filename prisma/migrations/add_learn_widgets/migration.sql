ALTER TABLE learn_content ADD COLUMN IF NOT EXISTS learn_widgets JSONB DEFAULT '[]';
COMMENT ON COLUMN learn_content.learn_widgets IS 'Array of interactive widget specs rendered on the Learn page. Each entry has type, position, and config fields. See lib/learn-widgets.ts for schema.';
