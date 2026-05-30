-- OIT reflection: "What did you figure out today?"
-- Organismic Integration Theory (SDT) — helps children internalise the value
-- of learning rather than just enjoying the app. No edtech competitor has this.
-- Research: Alberts, Lyngs & Lukoff 2024 (Oxford Academic, Interacting with Computers)

CREATE TABLE IF NOT EXISTS quiz_reflections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id   UUID NOT NULL REFERENCES topics(id)   ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_reflections_profile_id_idx ON quiz_reflections(profile_id);
CREATE INDEX IF NOT EXISTS quiz_reflections_created_at_idx ON quiz_reflections(created_at DESC);

-- RLS: only the owning profile and their linked parent can read reflections
ALTER TABLE quiz_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "child_own_reflections" ON quiz_reflections
  FOR ALL USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );
