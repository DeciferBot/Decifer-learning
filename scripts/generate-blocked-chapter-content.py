#!/usr/bin/env python3
"""
generate-blocked-chapter-content.py — fill curriculum_units.content_json for units
Oak cannot serve (copyright-blocked texts, bespoke topics, retired slugs).

Oak blocks /lessons/{slug}/summary for lessons built on copyrighted texts (poems,
novels). The lessons-list endpoint still returns real lesson titles, so we keep
Oak's lesson sequence and generate our own study-guide content (key learning
points, keywords, misconceptions) with Claude — no copyrighted text reproduced.
Output is attributed "Decifer Learning", which the chapter page renders with a
distinct footer (not the OGL/Oak attribution).

Per CLAUDE.md: LLMs may generate/explain learn content (this is not a canonical
answer to a verifiable question). OAK_API_KEY stays on the droplet.

Usage (on the droplet):
  python3 scripts/generate-blocked-chapter-content.py --dry-run
  python3 scripts/generate-blocked-chapter-content.py
  python3 scripts/generate-blocked-chapter-content.py --limit 5
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys, time, urllib.parse, urllib.request

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
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip().strip('"')
DATABASE_URL = os.environ["DATABASE_URL"].strip().strip('"')
CLAUDE_MODEL = "claude-sonnet-4-6"
MAX_UNIT_LESSONS = 6
PACE_SECONDS = 0.35

YEAR_AGE = {
    "year-1": "ages 5-6", "year-2": "ages 6-7", "year-3": "ages 7-8",
    "year-4": "ages 8-9", "year-5": "ages 9-10", "year-6": "ages 10-11",
    "year-7": "ages 11-12", "year-8": "ages 12-13", "year-9": "ages 13-14",
    "year-10": "ages 14-15", "year-11": "ages 15-16",
}


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
            return None
        if e.code == 429:
            time.sleep(10)
            return oak_get(path)
        raise
    finally:
        time.sleep(PACE_SECONDS)


def slug_to_title(slug: str) -> str:
    return slug.replace("-", " ").strip().capitalize()


def fetch_lesson_plan(unit_slug_full: str) -> tuple[list[str], str | None]:
    """Return (lesson titles, oak canonical url) for a unit slug. Falls back to
    deriving a title from the slug when Oak has nothing."""
    parts = unit_slug_full.split("/")
    if len(parts) >= 5:
        subject_slug, key_stage, _, unit_slug, lesson_slug = parts[:5]
        data = oak_get(
            f"/key-stages/{key_stage}/subject/{subject_slug}/lessons?unit={urllib.parse.quote(unit_slug)}"
        )
        if isinstance(data, list):
            for group in data:
                for lesson in group.get("lessons") or []:
                    if lesson.get("lessonSlug") == lesson_slug:
                        url = f"https://www.thenational.academy/teachers/lessons/{lesson_slug}"
                        return [lesson.get("lessonTitle") or slug_to_title(lesson_slug)], url
        return [slug_to_title(lesson_slug)], None
    if len(parts) == 4:
        subject_slug, key_stage, _, unit_slug = parts
        data = oak_get(
            f"/key-stages/{key_stage}/subject/{subject_slug}/lessons?unit={urllib.parse.quote(unit_slug)}"
        )
        titles: list[str] = []
        if isinstance(data, list):
            for group in data:
                for lesson in group.get("lessons") or []:
                    t = lesson.get("lessonTitle")
                    if t:
                        titles.append(t)
        url = f"https://www.thenational.academy/teachers/units/{unit_slug}" if titles else None
        return titles[:MAX_UNIT_LESSONS], url
    return [], None


def claude_generate(unit_title: str, subject: str, year: str, lesson_titles: list[str]) -> list[dict] | None:
    age = YEAR_AGE.get(year, "school-age")
    lessons_block = "\n".join(f"- {t}" for t in lesson_titles)
    prompt = f"""You are writing study-guide notes for a UK National Curriculum learning app.

Unit: "{unit_title}" ({subject}, {year}, {age})
Lessons in this unit:
{lessons_block}

For EACH lesson above, write study-guide metadata. Rules:
- Age-appropriate language for {age}.
- Do NOT quote or reproduce any copyrighted text (poems, novels, plays). Describe themes, techniques, and skills instead.
- British English.

Return ONLY a JSON array, one object per lesson, in the same order:
[{{
  "lessonTitle": "<copy the lesson title exactly>",
  "pupilLessonOutcome": "<one sentence: what the pupil can do after this lesson>",
  "keyLearningPoints": ["<3-5 short points>"],
  "keywords": [{{"keyword": "<term>", "description": "<child-friendly definition>"}}],
  "misconceptions": [{{"misconception": "<common mistake>", "response": "<correction>"}}]
}}]
Each lesson: 3-5 keyLearningPoints, 2-4 keywords, 1-2 misconceptions."""

    body = json.dumps({
        "model": CLAUDE_MODEL,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                data = json.loads(res.read().decode())
            text = data["content"][0]["text"].strip()
            if text.startswith("```"):
                text = text.split("```")[1].lstrip("json").strip()
            lessons = json.loads(text)
            if isinstance(lessons, list) and lessons:
                return lessons
        except Exception as exc:
            print(f"    claude error (attempt {attempt + 1}): {exc}")
            time.sleep(5 * (attempt + 1))
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if not OAK_KEY or not ANTHROPIC_KEY:
        sys.exit("OAK_API_KEY / ANTHROPIC_API_KEY missing — run on the droplet")

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    sql = """
        SELECT cu.id, cu.oak_unit_slug, cu.title, s.name AS subject, yg.label AS year
        FROM curriculum_units cu
        JOIN subjects s ON cu.subject_id = s.id
        JOIN year_groups yg ON cu.year_group_id = yg.id
        WHERE cu.oak_unit_slug IS NOT NULL AND cu.content_json IS NULL
        ORDER BY cu.created_at
    """
    if args.limit:
        sql += f" LIMIT {args.limit}"
    cur.execute(sql)
    rows = cur.fetchall()
    print(f"{len(rows)} blocked units to generate")
    if args.dry_run:
        for r in rows:
            print(" ", r["oak_unit_slug"])
        return

    ok = failed = 0
    for i, row in enumerate(rows, 1):
        print(f"[{i}/{len(rows)}] {row['oak_unit_slug']}")
        lesson_titles, canonical = fetch_lesson_plan(row["oak_unit_slug"])
        if not lesson_titles:
            # nothing on Oak at all (bespoke/retired) — generate a 4-lesson plan from the unit title
            lesson_titles = [
                f"Introducing {row['title']}",
                f"Exploring {row['title']}",
                f"Understanding {row['title']} in depth",
                f"Reviewing {row['title']}",
            ]
        lessons = claude_generate(row["title"], row["subject"], row["year"], lesson_titles)
        if not lessons:
            failed += 1
            print("    FAILED to generate")
            continue
        content = {"lessons": lessons, "attribution": "Decifer Learning", "canonicalUrl": canonical}
        cur.execute(
            "UPDATE curriculum_units SET content_json = %s, content_fetched_at = now() WHERE id = %s",
            (json.dumps(content), row["id"]),
        )
        ok += 1
        print(f"    ok — {len(lessons)} lessons")

    print(f"FINISHED: {ok} generated, {failed} failed of {len(rows)}")


if __name__ == "__main__":
    main()
