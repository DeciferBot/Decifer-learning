#!/usr/bin/env python3
"""
build_poetry.py — rebuild the '19th-Century Poetry' Y9 topic from VERIFIED public-domain
poem texts (/tmp/poems.json, extracted+verified from Palgrave's Golden Treasury).

Builds: learn_content.body_html (verbatim poems as HTML) + curriculum_units (one chapter
per poem, factual framing only) + curriculum_chunks (poem text for quiz grounding).
Does NOT republish — that happens after the quiz is generated and verified.
Idempotent: deletes this topic's existing units/chunks(for this source) before re-inserting.
"""
from __future__ import annotations
import html, json, os, subprocess, sys, uuid

_e = subprocess.run(["bash","-c","set -a && source /root/decifer-learning/.env.local && set +a && env"],
                    capture_output=True, text=True).stdout
for line in _e.splitlines():
    if "=" in line:
        k,_,v = line.partition("="); os.environ.setdefault(k.strip(), v.strip())
if not os.environ.get("DATABASE_URL") and os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]
DATABASE_URL = os.environ["DATABASE_URL"].strip().strip('"')
sys.path.insert(0, "/root/decifer-learning/services/content-pipeline")
import config
from pipeline import embed_text
import psycopg2, psycopg2.extras

TOPIC = "a2db7161-ea0f-4100-967a-01c34e5b5b8a"   # Reading: 19th-Century Poetry (Y9)
SUBJECT, YEAR = "English", "year-9"
SOURCE = "Public domain — Palgrave's Golden Treasury (Project Gutenberg)"
ORDER = ["ozymandias","she_walks","westminster","world_too_much"]
FORM = {"ozymandias":"a 14-line sonnet","westminster":"a 14-line sonnet",
        "world_too_much":"a 14-line sonnet","she_walks":"a lyric poem of 18 lines (three six-line stanzas)"}

poems = json.load(open("/tmp/poems.json", encoding="utf-8"))
assert all(k in poems for k in ORDER), "missing verified poems"

def poem_html(p):
    # preserve exact lines; blank line -> stanza gap
    out, lines = [], p["text"].split("\n")
    out.append('<p style="white-space:pre-wrap;line-height:1.7">')
    out.append("\n".join(html.escape(l) for l in lines))
    out.append("</p>")
    return "\n".join(out)

def build_body():
    secs = ['<h2>Reading 19th-Century Poetry</h2>',
            '<p>Read each of these famous poems from the 1800s carefully. '
            'They are printed here exactly as written. Read each one twice — once for the story, '
            'once for the feelings and pictures the words create.</p>']
    for k in ORDER:
        p = poems[k]
        secs.append(f'<h2>{html.escape(p["title"])} — {html.escape(p["author"])}</h2>')
        secs.append(f'<p><em>{html.escape(p["author"])}, written around {html.escape(p["year"])}. This is {FORM[k]}.</em></p>')
        secs.append(poem_html(p))
    return "\n".join(secs)

def main():
    conn = psycopg2.connect(DATABASE_URL); conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT subject_id, year_group_id FROM topics WHERE id=%s", (TOPIC,))
    t = cur.fetchone(); sid, ygid = t["subject_id"], t["year_group_id"]

    # 1) chapters (factual framing only)
    cur.execute("DELETE FROM curriculum_units WHERE topic_id=%s", (TOPIC,))
    rows = []
    for i, k in enumerate(ORDER):
        p = poems[k]
        klp = [f"‘{p['title']}’ was written by {p['author']} around {p['year']}.",
               f"It is {FORM[k]}.",
               "Read the full poem on the Learn page, then answer questions about its meaning and language."]
        content = {"lessons": [{"lessonTitle": f"{p['title']} by {p['author']}",
                                "pupilLessonOutcome": f"Read and study ‘{p['title']}’, {FORM[k]} by {p['author']}.",
                                "keyLearningPoints": klp, "keywords": [], "misconceptions": []}],
                   "attribution": SOURCE, "canonicalUrl": None}
        rows.append((str(uuid.uuid4()), sid, ygid, TOPIC, f"{p['title']} by {p['author']}", "",
                     i, None, "high", json.dumps(content)))
    psycopg2.extras.execute_values(cur,
        "INSERT INTO curriculum_units (id,subject_id,year_group_id,topic_id,title,description,order_index,oak_unit_slug,oak_confidence,content_json,content_fetched_at,created_at) VALUES %s",
        rows, template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now(),now())")

    # 2) learn_content
    body = build_body()
    cur.execute("SELECT id FROM learn_content WHERE topic_id=%s", (TOPIC,))
    lc = cur.fetchone()
    if lc: cur.execute("UPDATE learn_content SET body_html=%s, status='published' WHERE id=%s", (body, lc["id"]))
    else:  cur.execute("INSERT INTO learn_content (id,topic_id,body_html,status) VALUES (%s,%s,%s,'published')", (str(uuid.uuid4()), TOPIC, body))

    # 3) chunks for quiz grounding (full verbatim poem + facts)
    cur.execute("DELETE FROM curriculum_chunks WHERE subject=%s AND year_group=%s AND source_name=%s", (SUBJECT, YEAR, SOURCE))
    n = 0
    for k in ORDER:
        p = poems[k]
        chunk = (f"[English year-9] 19th-century poetry. ‘{p['title']}’ by {p['author']} "
                 f"(written around {p['year']}); {FORM[k]}.\n\nFull text of the poem:\n{p['text']}")
        emb = embed_text(chunk)
        if emb is None: raise SystemExit("embed failed")
        cur.execute("INSERT INTO curriculum_chunks (id,subject,year_group,source_name,chunk_text,embedding) VALUES (%s,%s,%s,%s,%s,%s::vector)",
                    (str(uuid.uuid4()), SUBJECT, YEAR, SOURCE, chunk, str(emb.tolist())))
        n += 1
    conn.commit()
    print(f"OK: {len(rows)} chapters, learn_content rebuilt, {n} poem chunks. Topic still UNPUBLISHED (republish after quiz).")
    cur.close(); conn.close()

if __name__ == "__main__":
    main()
