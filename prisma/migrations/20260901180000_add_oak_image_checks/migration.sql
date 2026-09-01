-- Which Oak pictures actually load.
--
-- Oak questions carry pictures: a diagram beside the question, or a set of pictures
-- to choose between. A link that has stopped working turns into a broken box on a
-- child's screen, and for a picture-choice question it makes the question
-- unanswerable. Holding a link is not the same as knowing it works.
--
-- So every picture is fetched once and the result kept here. Nothing is shown to a
-- child from a link that has not come back healthy. Checking once and remembering
-- means a re-run costs nothing, and a picture that breaks later is caught by the
-- next sweep rather than by a child.

CREATE TABLE IF NOT EXISTS oak_image_checks (
  url         TEXT PRIMARY KEY,
  ok          BOOLEAN NOT NULL,
  http_status INT,
  content_type TEXT,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oak_image_checks_ok_idx ON oak_image_checks (ok);

-- Never reachable from a browser; only the nightly jobs touch it.
ALTER TABLE oak_image_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON oak_image_checks FROM anon, authenticated;
