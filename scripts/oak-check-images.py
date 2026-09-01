#!/usr/bin/env python3
"""
Fetch every Oak picture once and record whether it really loads.

WHY. A question that says "which of these is a circle?" is unanswerable if one of
the pictures does not appear. Holding a link is not the same as knowing it works,
and a child finding out is the worst possible way to find out. So nothing with a
picture goes live until that picture has come back healthy from this check.

It covers BOTH kinds: the diagram that sits beside a question, and the pictures a
child chooses between.

CHEAP TO RE-RUN. A result is remembered, so a second run only looks at links it has
never seen. Pass --recheck-days to look again at ones checked a while ago, which is
how a picture that breaks later gets caught by us rather than by a child.

This talks to Oak's picture host, not to Oak's question service, so it does not
touch the daily allowance the lesson collector depends on.

Usage:
  python3 scripts/oak-check-images.py                 # check anything never checked
  python3 scripts/oak-check-images.py --recheck-days 30
  python3 scripts/oak-check-images.py --limit 500
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

for _envfile in (REPO / ".env.local", Path("/root/decifer-learning/.env.local")):
    if _envfile.exists():
        _e = subprocess.run(["bash", "-c", f"set -a && source {_envfile} && set +a && env"],
                            capture_output=True, text=True).stdout
        for line in _e.splitlines():
            if "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k, v)
        break

import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402


def dsn() -> str:
    raw = (os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL") or "").strip().strip('"')
    if not raw:
        sys.exit("no DIRECT_URL or DATABASE_URL in the environment")
    return raw.split("?")[0]


# Every picture Oak attaches to a question, from both quizzes, in one sweep:
# the diagram beside the question, and each picture among the choices.
FIND_URLS = """
WITH items AS (
  SELECT jsonb_array_elements(
           COALESCE(quiz_json->'starterQuiz', '[]'::jsonb) ||
           COALESCE(quiz_json->'exitQuiz',    '[]'::jsonb)) AS it
  FROM oak_lessons_raw WHERE fetch_status = 'done' AND quiz_json IS NOT NULL
),
urls AS (
  SELECT it->'questionImage'->>'url' AS url FROM items
  UNION
  SELECT a->'content'->>'url'
  FROM items, jsonb_array_elements(it->'answers') a
  WHERE a->>'type' = 'image'
)
SELECT DISTINCT url FROM urls
-- %% is a literal per cent here: this text is passed through a formatter that
-- treats a single one as a slot to fill in.
WHERE url LIKE 'https://%%'
  AND url NOT IN (
        SELECT url FROM oak_image_checks
        WHERE ok OR checked_at > now() - (%s || ' days')::interval)
"""


def check(url: str) -> tuple[str, bool, int | None, str | None]:
    """
    One picture. A HEAD request first because it is cheap; some hosts refuse HEAD,
    so fall back to asking for the file and reading only the first bytes.
    """
    for method in ("HEAD", "GET"):
        req = urllib.request.Request(url, method=method,
                                     headers={"User-Agent": "Decifer-Learning/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                ctype = (r.headers.get("Content-Type") or "").split(";")[0].strip()
                if method == "GET":
                    r.read(1024)
                # A page of HTML where a picture should be is a broken link wearing
                # a disguise — some hosts answer 200 with an error page.
                return url, ctype.startswith("image/"), r.status, ctype
        except urllib.error.HTTPError as ex:
            if method == "HEAD" and ex.code in (403, 405):
                continue                      # this host dislikes HEAD; try GET
            return url, False, ex.code, None
        except Exception:
            if method == "HEAD":
                continue
            return url, False, None, None
    return url, False, None, None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--recheck-days", type=int, default=0,
                    help="also look again at links checked more than this many days ago")
    ap.add_argument("--limit", type=int, default=0, help="stop after this many")
    ap.add_argument("--workers", type=int, default=12)
    args = ap.parse_args()

    conn = psycopg2.connect(dsn())
    cur = conn.cursor()
    cur.execute(FIND_URLS, (str(max(0, args.recheck_days)),))
    urls = [r[0] for r in cur.fetchall()]
    if args.limit:
        urls = urls[:args.limit]

    if not urls:
        print("Every Oak picture has already been checked.")
        return 0
    print(f"Checking {len(urls)} pictures.")

    good = bad = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        batch = []
        for url, ok, status, ctype in pool.map(check, urls):
            batch.append((url, ok, status, ctype))
            good += ok
            bad += not ok
            if len(batch) >= 200:
                save(cur, batch)
                conn.commit()
                print(f"  {good} fine, {bad} broken so far")
                batch = []
        if batch:
            save(cur, batch)
            conn.commit()

    print(f"\n{good} pictures load. {bad} do not and will never be shown to a child.")
    return 0


def save(cur, rows) -> None:
    psycopg2.extras.execute_batch(cur, """
        INSERT INTO oak_image_checks (url, ok, http_status, content_type, checked_at)
        VALUES (%s, %s, %s, %s, now())
        ON CONFLICT (url) DO UPDATE
          SET ok = EXCLUDED.ok, http_status = EXCLUDED.http_status,
              content_type = EXCLUDED.content_type, checked_at = now()
    """, rows, page_size=200)


if __name__ == "__main__":
    raise SystemExit(main())
