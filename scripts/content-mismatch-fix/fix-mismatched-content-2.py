#!/usr/bin/env python3
"""
fix-mismatched-content-2.py — round 2: resolve cross-topic unique-constraint conflicts.

Single all-or-nothing transaction: build every topic's new rows in memory (de-duping
lesson slugs), snapshot any topic not already backed up, then DELETE all involved topics'
old curriculum_units rows BEFORE inserting any new ones — so units currently held by one
broken topic (e.g. World War One unit on 'Contemporary World Issues') free up for their
correct topic atomically. Rebuilds learn_content.body_html too.
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
MAP_FILE = "/tmp/correction-map-2.json"
BACKUP   = "curriculum_units_bkp_mismatch_20260623"
LC_BACKUP = "learn_content_bkp_mismatch_20260623"
PACE = 0.35


def oak_get(path):
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


def normalise_summary(s):
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
    rows, idx, seen = [], 0, set()          # seen = de-dupe full oak_unit_slug
    for full in unit_slugs:
        parts = full.split("/")
        if len(parts) != 4:
            print(f"      ! bad unit slug: {full}"); continue
        subj, ks, year, unit = parts
        lessons = get_lessons_for_unit(ks, subj, unit)
        if not lessons:
            print(f"      ! Oak returned no lessons for {full}"); continue
        for lesson in lessons:
            lslug = lesson.get("lessonSlug")
            if not lslug: continue
            full_slug = f"{subj}/{ks}/{year}/{unit}/{lslug}"
            if full_slug in seen:            # Oak sometimes lists a lesson twice
                continue
            seen.add(full_slug)
            summary = oak_get(f"/lessons/{lslug}/summary")
            if not isinstance(summary, dict):
                print(f"      ! no summary for {lslug}"); continue
            content = {"lessons": [normalise_summary(summary)], "attribution": "Oak National Academy",
                       "canonicalUrl": summary.get("canonicalUrl")}
            rows.append({"id": str(uuid.uuid4()), "subject_id": topic["subject_id"],
                "year_group_id": topic["year_group_id"], "topic_id": topic["topic_id"],
                "title": (lesson.get("lessonTitle") or summary.get("lessonTitle") or "Lesson")[:255],
                "order_index": idx, "oak_unit_slug": full_slug, "content_json": content,
                "unit_question": unit.replace("-", " ")})
            idx += 1
    return rows or None


def build_body_html(rows):
    parts, last = [], None
    for r in rows:
        c = r["content_json"]["lessons"][0]; uq = r.get("unit_question")
        if uq != last: parts.append(f"<h2>{html.escape(uq.title())}</h2>"); last = uq
        if c.get("lessonTitle"): parts.append(f"<h3>{html.escape(c['lessonTitle'])}</h3>")
        if c.get("pupilLessonOutcome"): parts.append(f"<p>{html.escape(c['pupilLessonOutcome'])}</p>")
        klps = c.get("keyLearningPoints") or []
        if klps:
            parts.append("<h3>Key Learning Points</h3><ul>")
            parts.extend(f"<li>{html.escape(k)}</li>" for k in klps); parts.append("</ul>")
    return "\n".join(parts)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not OAK_KEY: sys.exit("OAK_API_KEY missing")

    cmap = json.load(open(MAP_FILE))["map"]
    conn = psycopg2.connect(DATABASE_URL); conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    ids = list(cmap.keys())
    cur.execute("SELECT id AS topic_id, subject_id, year_group_id, title FROM topics WHERE id::text = ANY(%s)", (ids,))
    topics = {r["topic_id"]: r for r in cur.fetchall()}

    # 1) build every topic's rows in memory (no writes yet)
    built = {}
    for tid, entry in cmap.items():
        topic = topics.get(tid)
        if not topic: print(f"• {entry['title']}: NOT FOUND — abort"); sys.exit(1)
        print(f"• {entry['title']}")
        rows = build_rows(topic, entry["units"])
        if not rows: print(f"    ! 0 lessons — abort to stay safe"); sys.exit(1)
        built[tid] = rows
        print(f"    -> {len(rows)} chapters; first: {rows[0]['title'][:55]!r}")

    total = sum(len(v) for v in built.values())
    print(f"\nbuilt {total} rows for {len(built)} topics")
    if args.dry_run:
        print("DRY RUN — no writes"); return

    # 2) snapshot any topic not already in BACKUP (round-1 backed up only its 18 ids)
    cur.execute(f"SELECT DISTINCT topic_id::text AS t FROM {BACKUP}")
    backed = {r["t"] for r in cur.fetchall()}
    missing = [i for i in ids if i not in backed]
    if missing:
        cur.execute(f"INSERT INTO {BACKUP} SELECT * FROM curriculum_units WHERE topic_id::text = ANY(%s)", (missing,))
        cur.execute(f"INSERT INTO {LC_BACKUP} SELECT * FROM learn_content WHERE topic_id::text = ANY(%s)", (missing,))
        print(f"snapshot added for {len(missing)} new topics")

    # 3) ONE transaction: delete all old rows for all involved topics, then insert all new
    try:
        cur.execute("DELETE FROM curriculum_units WHERE topic_id::text = ANY(%s)", (ids,))
        all_rows = [r for tid in built for r in built[tid]]
        psycopg2.extras.execute_values(cur, """
            INSERT INTO curriculum_units
              (id, subject_id, year_group_id, topic_id, title, description,
               order_index, oak_unit_slug, oak_confidence, content_json, content_fetched_at, created_at)
            VALUES %s
        """, [(r["id"], r["subject_id"], r["year_group_id"], r["topic_id"], r["title"], "",
               r["order_index"], r["oak_unit_slug"], "high", json.dumps(r["content_json"]))
              for r in all_rows],
            template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now(),now())")
        for tid, rows in built.items():
            body = build_body_html(rows)
            cur.execute("SELECT id FROM learn_content WHERE topic_id=%s", (tid,))
            lc = cur.fetchone()
            if lc: cur.execute("UPDATE learn_content SET body_html=%s WHERE id=%s", (body, lc["id"]))
            else:  cur.execute("INSERT INTO learn_content (id, topic_id, body_html, status) VALUES (%s,%s,%s,'published')", (str(uuid.uuid4()), tid, body))
        conn.commit()
        print(f"\nCOMMITTED: {len(built)} topics, {total} chapter rows, learn_content rebuilt ✓")
    except Exception as ex:
        conn.rollback(); print(f"\nERROR — rolled back, NOTHING changed: {ex}"); sys.exit(1)
    cur.close(); conn.close()


if __name__ == "__main__":
    main()
