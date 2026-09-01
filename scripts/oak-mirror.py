"""
Mirror Oak National Academy's lesson quizzes + summaries into oak_lessons_raw.

WHY: every Oak import so far — ingest-oak-questions.py, oak_targeted_import.py,
oak_import_job.py — re-fetches the same lesson quiz from the live API each time
it runs, and Oak throttles hard (403 after roughly 1,000 calls/day; see
[[project-oak-coverage-gap]]). That rate limit is spent on REPEAT fetches, not
on reaching new content. We hold 8,509 lessons of coverage and have imported
about 1%.

THIS SCRIPT FETCHES EACH LESSON ONCE, EVER. After it, extending the topic map,
adding new question types (match/order/short-answer), or re-mapping a unit to
a different topic is local SQL against oak_lessons_raw — no Oak API call, no
rate limit, run it as many times as needed.

Walks all 4 key stages x our 5 subjects. A unit list is fetched once per
(key_stage, subject) pair — NOT once per year, unlike the existing importers,
since Oak's /units endpoint already returns every year group in the key stage.
Each lesson's quiz + summary is fetched once and upserted; a lesson already
fetch_status='done' is skipped on every future run (idempotent, resumable —
kill it anytime, rerun picks up where it stopped).

Self-limiting: aborts after 8 consecutive 429/403s rather than hammering a
rate-limited API (same rule as ingest-oak-questions.py's oak() helper), and
stops cleanly at --max-calls so it can run as a bounded nightly cron.

Usage:
  python3 scripts/oak-mirror.py --max-calls 50 --dry-run   # see the plan
  python3 scripts/oak-mirror.py --max-calls 1200           # one bounded pass
  python3 scripts/oak-mirror.py --all                      # run to exhaustion (days)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

_REPO = "/root/decifer-learning"

_e = subprocess.run(
    ["bash", "-c", f"set -a && source {_REPO}/.env.local && set +a && env"],
    capture_output=True, text=True,
).stdout
for line in _e.splitlines():
    if "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k, v)
if not os.environ.get("DATABASE_URL") and os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402

OAK_BASE = "https://open-api.thenational.academy/api/v0"
OAK_KEY = os.environ.get("OAK_API_KEY", "").strip().strip('"')
if not OAK_KEY:
    print("ERROR: OAK_API_KEY not set"); sys.exit(1)

SUBJECT_SLUG = {"Maths": "maths", "English": "english", "Science": "science",
                "History": "history", "Geography": "geography"}
KEY_STAGES = ("ks1", "ks2", "ks3", "ks4")

_CACHE_DIR = Path(os.environ.get("OAK_CACHE_DIR", "/tmp/oak-cache"))
_CACHE_DIR.mkdir(parents=True, exist_ok=True)
_MIN_INTERVAL = float(os.environ.get("OAK_MIN_INTERVAL", "1.0"))
_last_call = [0.0]
_MAX_THROTTLE_STREAK = 8
_throttle_streak = [0]
_call_budget = [0]  # set in main(), decremented on real (non-cached) calls


class BudgetExhausted(Exception):
    pass


def oak(path: str):
    """Fetch an Oak endpoint, from disk cache when possible. See module
    docstring — this is the same pacing/backoff contract as
    ingest-oak-questions.py's oak(), duplicated here so this script has no
    dependency on the pipeline's embedding stack."""
    url = path if path.startswith("http") else f"{OAK_BASE}{path}"
    key = hashlib.sha256(url.encode()).hexdigest()[:32]
    cached = _CACHE_DIR / f"{key}.json"
    if cached.exists():
        try:
            return json.loads(cached.read_text())
        except Exception:
            cached.unlink(missing_ok=True)

    if _call_budget[0] <= 0:
        raise BudgetExhausted(path)

    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {OAK_KEY}",
        "User-Agent": "Decifer-Learning/1.0 (+content mirror; contact chopraa@gmail.com)",
    })
    for attempt in range(5):
        gap = time.time() - _last_call[0]
        if gap < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - gap)
        _last_call[0] = time.time()
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode("utf-8"))
            _call_budget[0] -= 1
            _throttle_streak[0] = 0
            try:
                cached.write_text(json.dumps(data))
            except Exception:
                pass
            return data
        except urllib.error.HTTPError as ex:
            if ex.code in (429, 403):
                _throttle_streak[0] += 1
                if _throttle_streak[0] >= _MAX_THROTTLE_STREAK:
                    raise SystemExit(
                        f"\nSTOPPING: Oak returned {ex.code} {_throttle_streak[0]} times in "
                        f"a row. Rerun later — every lesson already written to "
                        f"oak_lessons_raw is safe and will not be re-fetched."
                    )
                wait = min(120, 10 * (attempt + 1) ** 2)
                print(f"    [oak] {ex.code} — backing off {wait}s", flush=True)
                time.sleep(wait)
                continue
            if ex.code in (500, 502, 503):
                time.sleep(3 * (attempt + 1)); continue
            if ex.code == 404:
                return None
            raise
        except Exception:
            time.sleep(3); continue
    raise RuntimeError(f"Oak fetch failed after retries: {url}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-calls", type=int, default=800,
                    help="live Oak API calls allowed this run (cache hits are free)")
    ap.add_argument("--all", action="store_true", help="no budget cap — run to exhaustion")
    ap.add_argument("--dry-run", action="store_true", help="show the plan, fetch nothing")
    ap.add_argument("--subject", nargs="*", default=None)
    ap.add_argument("--key-stage", nargs="*", default=None)
    args = ap.parse_args()
    _call_budget[0] = 10**9 if args.all else args.max_calls

    subjects = args.subject or list(SUBJECT_SLUG)
    key_stages = args.key_stage or list(KEY_STAGES)

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("SELECT lesson_slug FROM oak_lessons_raw WHERE fetch_status='done'")
    done = {r["lesson_slug"] for r in cur.fetchall()}
    print(f"{len(done)} lessons already mirrored. Budget this run: "
          f"{'unlimited' if args.all else args.max_calls} live calls.\n", flush=True)

    total_units = total_lessons = new_lessons = 0
    write_cur = conn.cursor()

    try:
        for ks in key_stages:
            for subject in subjects:
                oak_subject = SUBJECT_SLUG[subject]
                try:
                    unit_groups = oak(f"/key-stages/{ks}/subject/{oak_subject}/units")
                except BudgetExhausted:
                    raise
                except Exception as ex:
                    print(f"  ! {ks}/{subject} units fetch failed: {ex}")
                    continue
                if not unit_groups:
                    continue

                units = []
                for g in unit_groups:
                    yslug = g.get("yearSlug")
                    for u in (g.get("units") or []):
                        units.append((yslug, u))
                print(f"══ {ks} {subject}: {len(units)} units ══", flush=True)
                total_units += len(units)

                for yslug, unit in units:
                    unit_slug = unit.get("unitSlug")
                    if not unit_slug:
                        continue
                    try:
                        lgroups = oak(
                            f"/key-stages/{ks}/subject/{oak_subject}/lessons"
                            f"?unit={urllib.parse.quote(unit_slug)}"
                        )
                    except BudgetExhausted:
                        raise
                    except Exception:
                        continue
                    if not lgroups:
                        continue

                    lessons, seen = [], set()
                    for g in lgroups:
                        for L in g.get("lessons", []):
                            sl = L.get("lessonSlug")
                            if sl and sl not in seen:
                                seen.add(sl); lessons.append(L)
                    total_lessons += len(lessons)

                    for L in lessons:
                        slug = L["lessonSlug"]
                        if slug in done:
                            continue
                        try:
                            quiz = oak(f"/lessons/{slug}/quiz") or {}
                            summary = oak(f"/lessons/{slug}/summary") or {}
                        except BudgetExhausted:
                            raise
                        except Exception as ex:
                            write_cur.execute(
                                """INSERT INTO oak_lessons_raw
                                     (lesson_slug, unit_slug, key_stage, subject, oak_year_slug,
                                      lesson_title, fetch_status, fetched_at)
                                   VALUES (%s,%s,%s,%s,%s,%s,'error',now())
                                   ON CONFLICT (lesson_slug) DO UPDATE
                                     SET fetch_status='error', fetched_at=now()""",
                                (slug, unit_slug, ks, subject, yslug, L.get("lessonTitle")),
                            )
                            continue

                        if args.dry_run:
                            new_lessons += 1
                            continue

                        write_cur.execute(
                            """INSERT INTO oak_lessons_raw
                                 (lesson_slug, unit_slug, key_stage, subject, oak_year_slug,
                                  lesson_title, quiz_json, summary_json, fetch_status, fetched_at)
                               VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,'done',now())
                               ON CONFLICT (lesson_slug) DO UPDATE
                                 SET quiz_json=EXCLUDED.quiz_json,
                                     summary_json=EXCLUDED.summary_json,
                                     fetch_status='done', fetched_at=now()""",
                            (slug, unit_slug, ks, subject, yslug, L.get("lessonTitle"),
                             json.dumps(quiz), json.dumps(summary)),
                        )
                        done.add(slug)
                        new_lessons += 1
                        if new_lessons % 50 == 0:
                            print(f"  ... {new_lessons} new lessons mirrored "
                                  f"(budget left: {_call_budget[0]})", flush=True)
    except BudgetExhausted:
        print(f"\nBudget exhausted for this run — {new_lessons} new lessons mirrored. "
              f"Rerun to continue; nothing already written is refetched.", flush=True)

    total_done = len(done)
    print(f"\n{'Would mirror' if args.dry_run else 'Mirrored'} {new_lessons} new lessons "
          f"this run. {total_done} total done. Seen {total_units} units, "
          f"{total_lessons} lesson listings across the walk so far.")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
