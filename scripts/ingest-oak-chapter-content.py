#!/usr/bin/env python3
"""
ingest-oak-chapter-content.py — persist Oak lesson summaries into curriculum_units.content_json

Why: the child-facing chapter page (app/(child)/topics/[id]/units/[unitId]) must read
from the database, never from the Oak API at request time (CLAUDE.md §6: OAK_API_KEY
is never used in a public web service). This script runs on the DO droplet, which
holds the key, and writes a normalised summary JSON per chapter.

oak_unit_slug formats handled:
  5 segments  subject/ks/year/unit-slug/lesson-slug  → one lesson summary
  4 segments  subject/ks/year/unit-slug              → unit lesson list, up to 6 summaries

content_json shape (what the page renders — field names already normalised):
  {
    "lessons": [
      {
        "lessonTitle": str,
        "pupilLessonOutcome": str | null,
        "keyLearningPoints": [str],
        "keywords": [{"keyword": str, "description": str}],
        "misconceptions": [{"misconception": str, "response": str}]
      }
    ],
    "attribution": "Oak National Academy",
    "canonicalUrl": str | null
  }

Usage (on the droplet):
  python3 ingest-oak-chapter-content.py --dry-run
  python3 ingest-oak-chapter-content.py                 # only units with content_json IS NULL
  python3 ingest-oak-chapter-content.py --refresh-days 30   # also re-fetch stale rows
  python3 ingest-oak-chapter-content.py --limit 50
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys, time, urllib.parse, urllib.request

# ── Env setup (droplet convention, same as oak-rebuild-content.py) ───────────
_e = subprocess.run(
    ["bash", "-c", "set -a && source /root/decifer-learning/.env.local && set +a && env"],
    capture_output=True, text=True,
).stdout
for line in _e.splitlines():
    if "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())
if not os.environ.get("DATABASE_URL") and os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

import psycopg2, psycopg2.extras

OAK_BASE = "https://open-api.thenational.academy/api/v0"
OAK_KEY = os.environ.get("OAK_API_KEY", "").strip().strip('"')
DATABASE_URL = os.environ["DATABASE_URL"].strip().strip('"')

PACE_SECONDS = 0.35          # ~3 req/s, well under Oak limits
MAX_UNIT_LESSONS = 6         # cap for 4-segment (whole-unit) chapters


def oak_get(path: str) -> object | None:
    req = urllib.request.Request(
        f"{OAK_BASE}{path}",
        headers={"Authorization": f"Bearer {OAK_KEY}", "User-Agent": "Decifer-Learning/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        if e.code in (400, 404):
            return None  # some Oak slugs 400/404 — skip, do not crash
        if e.code == 429:
            time.sleep(10)
            return oak_get(path)
        raise
    finally:
        time.sleep(PACE_SECONDS)


def normalise_summary(s: dict) -> dict:
    return {
        "lessonTitle": s.get("lessonTitle"),
        "pupilLessonOutcome": s.get("pupilLessonOutcome"),
        "keyLearningPoints": [
            kp.get("keyLearningPoint") for kp in (s.get("keyLearningPoints") or []) if kp.get("keyLearningPoint")
        ],
        "keywords": [
            {"keyword": kw.get("keyword"), "description": kw.get("description")}
            for kw in (s.get("lessonKeywords") or []) if kw.get("keyword")
        ],
        "misconceptions": [
            {"misconception": m.get("misconception"), "response": m.get("response")}
            for m in (s.get("misconceptionsAndCommonMistakes") or []) if m.get("misconception")
        ],
    }


def fetch_content(slug: str) -> dict | None:
    parts = slug.split("/")
    lessons: list[dict] = []
    canonical = None

    if len(parts) >= 5:
        summary = oak_get(f"/lessons/{parts[4]}/summary")
        if isinstance(summary, dict):
            canonical = summary.get("canonicalUrl")
            lessons.append(normalise_summary(summary))
    elif len(parts) == 4:
        subject_slug, key_stage, _, unit_slug = parts
        data = oak_get(f"/key-stages/{key_stage}/subject/{subject_slug}/lessons?unit={urllib.parse.quote(unit_slug)}")
        unit_lessons = []
        if isinstance(data, list):
            for group in data:
                unit_lessons.extend(group.get("lessons") or [])
        for lesson in unit_lessons[:MAX_UNIT_LESSONS]:
            lesson_slug = lesson.get("lessonSlug")
            if not lesson_slug:
                continue
            summary = oak_get(f"/lessons/{lesson_slug}/summary")
            if isinstance(summary, dict):
                canonical = canonical or summary.get("canonicalUrl")
                lessons.append(normalise_summary(summary))

    if not lessons:
        return None
    return {"lessons": lessons, "attribution": "Oak National Academy", "canonicalUrl": canonical}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--refresh-days", type=int, default=0,
                    help="also re-fetch rows whose content is older than N days")
    ap.add_argument("--like", default="",
                    help="only units whose oak_unit_slug matches this SQL LIKE pattern, e.g. '%%/year-3/%%'")
    args = ap.parse_args()

    if not OAK_KEY:
        sys.exit("OAK_API_KEY missing — run on the droplet")

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    where = "oak_unit_slug IS NOT NULL AND (content_json IS NULL"
    if args.refresh_days:
        where += f" OR content_fetched_at < now() - interval '{args.refresh_days} days'"
    where += ")"
    params: list = []
    if args.like:
        where += " AND oak_unit_slug LIKE %s"
        params.append(args.like)
    sql = f"SELECT id, oak_unit_slug FROM curriculum_units WHERE {where} ORDER BY created_at"
    if args.limit:
        sql += f" LIMIT {args.limit}"
    cur.execute(sql, params)
    rows = cur.fetchall()
    print(f"{len(rows)} units to ingest")
    if args.dry_run:
        for r in rows[:20]:
            print(" ", r["oak_unit_slug"])
        return

    ok = missing = 0
    for i, row in enumerate(rows, 1):
        content = fetch_content(row["oak_unit_slug"])
        if content:
            cur.execute(
                "UPDATE curriculum_units SET content_json = %s, content_fetched_at = now() WHERE id = %s",
                (json.dumps(content), row["id"]),
            )
            ok += 1
        else:
            missing += 1
            print(f"  no content: {row['oak_unit_slug']}")
        if i % 50 == 0:
            print(f"  {i}/{len(rows)} done ({ok} ok, {missing} missing)")

    print(f"FINISHED: {ok} ingested, {missing} missing of {len(rows)}")


if __name__ == "__main__":
    main()
