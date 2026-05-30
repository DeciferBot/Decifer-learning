-- Add linked_at timestamp and seen_by_child flag to family_links
ALTER TABLE family_links
  ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS seen_by_child BOOLEAN NOT NULL DEFAULT false;

-- Enforce one-parent-per-child constraint
-- Drop if a partial index already existed under a different name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'family_links_child_user_id_key'
      AND conrelid = 'family_links'::regclass
  ) THEN
    ALTER TABLE family_links ADD CONSTRAINT family_links_child_user_id_key UNIQUE (child_user_id);
  END IF;
END$$;
