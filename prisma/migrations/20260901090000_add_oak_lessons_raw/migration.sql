-- Oak National Academy lesson mirror.
--
-- Created by hand on the droplet on 2026-08-18 and never written down here, so a
-- rebuilt database would have silently lost three weeks of collecting. This file
-- makes the table reproducible. Matches the live shape exactly (checked against
-- production 2026-09-01) and is safe to run against a database that already has it.
--
-- Why the table exists: every earlier Oak importer re-fetched the same lesson from
-- Oak on every run, and Oak cuts us off after roughly 1,000 fetches a day. So the
-- daily allowance was spent re-reading lessons we already had. This table holds each
-- lesson's quiz and summary exactly once, forever. Everything downstream — matching a
-- lesson to one of our topics, choosing which questions we can show, re-running after
-- a rule change — then reads this table and never touches Oak again.
--
-- Content is Oak National Academy, Open Government Licence v3.0.

CREATE TABLE IF NOT EXISTS oak_lessons_raw (
  lesson_slug   TEXT PRIMARY KEY,
  unit_slug     TEXT,
  key_stage     TEXT,
  subject       TEXT,
  oak_year_slug TEXT,
  lesson_title  TEXT,
  quiz_json     JSONB,
  summary_json  JSONB,
  fetch_status  TEXT,
  fetched_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oak_lessons_raw_subject_year_idx
  ON oak_lessons_raw (subject, oak_year_slug);
CREATE INDEX IF NOT EXISTS oak_lessons_raw_unit_idx
  ON oak_lessons_raw (unit_slug);
CREATE INDEX IF NOT EXISTS oak_lessons_raw_status_idx
  ON oak_lessons_raw (fetch_status);

-- Never reachable from a browser. Only the nightly jobs, which connect as the
-- service role, read or write it.
ALTER TABLE oak_lessons_raw ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON oak_lessons_raw FROM anon, authenticated;
