#!/usr/bin/env python3
"""
fix-mismatched-content.py — repoint wrong-subject topics to their CORRECT Oak unit(s)
and rebuild chapters (curriculum_units) + Learn page (learn_content.body_html).

Driven by a CURATED correction map (topic_id -> correct 4-part unit slugs), NOT a fuzzy
matcher (the fuzzy matcher is what caused the bug). Quiz regeneration is handled separately
(pipeline job) — this script fixes the two deterministic layers only.

Adapted from /tmp/reingest-split-chapters.py. Key differences:
  * Map-driven (explicit slugs), not backup-table-driven.
  * Regression gate INVERTED: a correct unit replaces wrong content even if it has FEWER
    lessons (correctness > volume). Only skips if Oak yields 0 lessons (leaves untouched).
  * Also rebuilds learn_content.body_html from the new lessons so the Learn tab matches.

Safety: per-topic single transaction (snapshot -> delete old rows -> insert new rows ->
update learn_content). Snapshots ALL affected rows to a backup table once before any change.

Usage (on droplet):
  /root/pipeline-venv/bin/python3 /tmp/fix-mismatched-content.py --dry-run
  /root/pipeline-venv/bin/python3 /tmp/fix-mismatched-content.py
"""
from __future__ import annotations
import argparse, html, json, os, subprocess, sys, time, urllib.parse, urllib.request, uuid

_e = subprocess.run(["bash","-c","set -a && source /root/decifer-learning/.env.local && set +a && env"],
                    capture_output=True, text=True).stdout
for line in _e.splitlines():
    if "=" in line:
        k,_,v = line.partition("="); os.environ.setdefault(k.strip(), v.strip())
if not os.environ.get("DATABASE_URL") and os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

import psycopg2, psycopg2.extras

OAK_BASE = "https://open-api.thenational.academy/api/v0"
OAK_KEY  = os.environ.get("OAK_API_KEY","").strip().strip('"')
DATABASE_URL = os.environ["DATABASE_URL"].strip().strip('"')
MAP_FILE = "/tmp/correction-map.json"
BACKUP   = "curriculum_units_bkp_mismatch_20260623"
LC_BACKUP = "learn_content_bkp_mismatch_20260623"
PACE = 0.35


def oak_get(path: str):
    req = urllib.request.Request(f"{OAK_BASE}{path}",
        headers={"Authorization": f"Bearer {OAK_KEY}", "User-Agent": "Decifer-Learning/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code in (400, 404): return None
        if e.code == 429: time.sleep(10); return oak_get(path)
        raise
    finally:
        time.sleep(PACE)


def normalise_summary(s: dict) -> dict:
    return {
        "lessonTitle": s.get("lessonTitle"),
        "pupilLessonOutcome": s.get("pupilLessonOutcome"),
        "keyLearningPoints": [kp.get("keyLearningPoint") for kp in (s.get("keyLearningPoints") or []) if kp.get("keyLearningPoint")],
        "keywords": [{"keyword": kw.get("keyword"), "description": kw.get("description")} for kw in (s.get("lessonKeywords") or []) if kw.get("keyword")],
        "misconceptions": [{"misconception": m.get("misconception"), "response": m.get("response")} for m in (s.get("misconceptionsAndCommonMistakes") or []) if m.get("misconception")],
    }


def get_lessons_for_unit(ks, subj, unit):
    data = oak_get(f"/key-stages/{ks}/subject/{subj}/lessons?unit={urllib.parse.quote(unit)}")
    out = []
    if isinstance(data, list):
        for g in data:
            out.extend(g.get("lessons") or [])
    return out


def build_rows(topic, unit_slugs):
    rows, idx = [], 0
    for full in unit_slugs:
        parts = full.split("/")
        if len(parts) != 4:
            print(f"      ! bad unit slug (need 4 parts): {full}"); continue
        subj, ks, year, unit = parts
        lessons = get_lessons_for_unit(ks, subj, unit)
        if not lessons:
            print(f"      ! Oak returned no lessons for {full}"); continue
        for lesson in lessons:
            lslug = lesson.get("lessonSlug")
            if not lslug: continue
            summary = oak_get(f"/lessons/{lslug}/summary")
            if not isinstance(summary, dict):
                print(f"      ! no summary for lesson {lslug}"); continue
            content = {"lessons": [normalise_summary(summary)], "attribution": "Oak National Academy",
                       "canonicalUrl": summary.get("canonicalUrl")}
            rows.append({
                "id": str(uuid.uuid4()), "subject_id": topic["subject_id"],
                "year_group_id": topic["year_group_id"], "topic_id": topic["topic_id"],
                "title": (lesson.get("lessonTitle") or summary.get("lessonTitle") or "Lesson")[:255],
                "order_index": idx, "oak_unit_slug": f"{subj}/{ks}/{year}/{unit}/{lslug}",
                "content_json": content, "unit_question": unit.replace("-", " "),
            })
            idx += 1
    return rows or None


def build_body_html(rows):
    """Rebuild learn_content.body_html from the new lessons (matches existing shape)."""
    parts, last_unit = [], None
    for r in rows:
        c = r["content_json"]["lessons"][0]
        unit_q = r.get("unit_question")
        if unit_q != last_unit:
            parts.append(f"<h2>{html.escape(unit_q.title())}</h2>")
            last_unit = unit_q
        if c.get("lessonTitle"):
            parts.append(f"<h3>{html.escape(c['lessonTitle'])}</h3>")
        if c.get("pupilLessonOutcome"):
            parts.append(f"<p>{html.escape(c['pupilLessonOutcome'])}</p>")
        klps = c.get("keyLearningPoints") or []
        if klps:
            parts.append("<h3>Key Learning Points</h3><ul>")
            parts.extend(f"<li>{html.escape(k)}</li>" for k in klps)
            parts.append("</ul>")
    return "\n".join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not OAK_KEY: sys.exit("OAK_API_KEY missing — run on droplet")

    cmap = json.load(open(MAP_FILE))["map"]
    conn = psycopg2.connect(DATABASE_URL); conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    ids = list(cmap.keys())
    cur.execute("""SELECT id AS topic_id, subject_id, year_group_id, title
                   FROM topics WHERE id::text = ANY(%s)""", (ids,))
    topics = {r["topic_id"]: r for r in cur.fetchall()}

    if not args.dry_run:
        for tbl, src in [(BACKUP, f"curriculum_units WHERE topic_id::text = ANY(%s)"),
                         (LC_BACKUP, f"learn_content WHERE topic_id::text = ANY(%s)")]:
            cur.execute(f"SELECT to_regclass('public.{tbl}') AS t")
            if cur.fetchone()["t"] is None:
                cur.execute(f"CREATE TABLE {tbl} AS SELECT * FROM {src}", (ids,))
                conn.commit(); print(f"snapshot -> {tbl}")
        print()

    swapped = skipped = total_new = 0
    for tid, entry in cmap.items():
        topic = topics.get(tid)
        if not topic:
            print(f"• {entry['title']}: TOPIC NOT FOUND ({tid}) — skip\n"); skipped += 1; continue
        cur.execute("SELECT count(*) AS c FROM curriculum_units WHERE topic_id=%s", (tid,))
        cur_count = cur.fetchone()["c"]
        print(f"• {entry['title']}  (current {cur_count} chapters)")
        for u in entry["units"]:
            print(f"    target: {u}")

        new_rows = build_rows(topic, entry["units"])
        new_count = len(new_rows) if new_rows else 0
        if not new_rows:
            print(f"    SKIP — Oak yielded 0 lessons (left untouched)\n"); skipped += 1; continue

        delta = f"(+{new_count - cur_count})" if new_count > cur_count else (f"({new_count - cur_count})" if new_count < cur_count else "(same)")
        print(f"    -> {new_count} new chapters {delta}; first: {new_rows[0]['title'][:50]!r}")
        total_new += new_count

        if args.dry_run:
            swapped += 1; print(); continue

        cur.execute("SELECT id FROM curriculum_units WHERE topic_id=%s", (tid,))
        old_ids = [r["id"] for r in cur.fetchall()]
        try:
            cur.execute("DELETE FROM curriculum_units WHERE id::text = ANY(%s)", (old_ids,))
            psycopg2.extras.execute_values(cur, """
                INSERT INTO curriculum_units
                  (id, subject_id, year_group_id, topic_id, title, description,
                   order_index, oak_unit_slug, oak_confidence, content_json,
                   content_fetched_at, created_at)
                VALUES %s
            """, [(r["id"], r["subject_id"], r["year_group_id"], r["topic_id"], r["title"], "",
                   r["order_index"], r["oak_unit_slug"], "high", json.dumps(r["content_json"]))
                  for r in new_rows],
                template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now(),now())")
            # rebuild Learn page
            body = build_body_html(new_rows)
            cur.execute("SELECT id FROM learn_content WHERE topic_id=%s", (tid,))
            lc = cur.fetchone()
            if lc:
                cur.execute("UPDATE learn_content SET body_html=%s WHERE id=%s", (body, lc["id"]))
            else:
                cur.execute("""INSERT INTO learn_content (id, topic_id, body_html, status)
                               VALUES (%s,%s,%s,'published')""", (str(uuid.uuid4()), tid, body))
            conn.commit(); swapped += 1; print(f"    swapped + learn rebuilt ✓\n")
        except Exception as ex:
            conn.rollback(); print(f"    ERROR — rolled back, topic untouched: {ex}\n"); skipped += 1

    print(f"{'DRY RUN — ' if args.dry_run else ''}DONE: {swapped} swapped, {skipped} skipped, {total_new} new chapter rows")
    cur.close(); conn.close()


if __name__ == "__main__":
    main()
