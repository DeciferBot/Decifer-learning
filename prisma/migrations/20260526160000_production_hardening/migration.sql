-- Migration: Production hardening — performance index + guardian zone guard
-- Fixes identified in production readiness audit.

-- ── point_events: add (profile_id, created_at) index ────────────────────────
-- This index is hit on every quiz submission (point award write),
-- weekly digest aggregate, and screen-time aggregate.
CREATE INDEX IF NOT EXISTS "point_events_profile_id_created_at_idx"
  ON "point_events"("profile_id", "created_at");
