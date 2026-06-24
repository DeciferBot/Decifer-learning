#!/usr/bin/env python3
"""
build_grammar.py — rebuild 'Grammar, Punctuation and Vocabulary' (Y10 English) from the
DfE National Curriculum English Appendix 2 (Crown copyright, OGL v3.0). Facts + examples
are faithful to that document (the advanced Y5-6 grammar/punctuation concepts that carry
through to GCSE). Builds chapters + learn_content + chunks under a dedicated source_name.
Quiz is english_grammar (LanguageTool-verified, threshold 85) — generated separately.
Does NOT republish.
"""
from __future__ import annotations
import html, os, subprocess, sys, uuid, json

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

TOPIC = "e74a6b78-5e70-40e8-a398-b25f53557cef"
SUBJECT, YEAR = "English", "year-10"
SOURCE = "DfE National Curriculum — English Appendix 2 (OGL v3.0)"
ATTR = ("Based on the DfE National Curriculum, English Appendix 2 (Vocabulary, grammar and "
        "punctuation), © Crown copyright 2013, Open Government Licence v3.0.")

CHAPTERS = [
 ("Relative clauses",
  "Identify and use relative clauses.",
  ["A relative clause adds information about a noun and usually begins with a relative pronoun: who, which, where, when, whose or that.",
   "The relative pronoun can sometimes be omitted (an 'omitted relative pronoun'), e.g. 'the book [that] I read'.",
   "Example: 'The scientist who discovered radium was Marie Curie' — 'who discovered radium' is the relative clause."]),
 ("Modal verbs",
  "Use modal verbs to show degrees of possibility.",
  ["Modal verbs indicate degrees of possibility or certainty: for example might, should, will, must.",
   "Degrees of possibility can also be shown with adverbs such as perhaps or surely.",
   "'It might rain' is less certain than 'It will rain'."]),
 ("Active and passive voice",
  "Recognise the difference between active and passive voice.",
  ["The passive voice changes how information is presented in a sentence.",
   "Active: 'I broke the window in the greenhouse.' Passive: 'The window in the greenhouse was broken (by me).'",
   "In the passive, the thing affected by the action becomes the subject of the sentence."]),
 ("Formal language and the subjunctive",
  "Distinguish formal from informal language and recognise the subjunctive.",
  ["Some vocabulary is informal and some is formal: for example 'find out' / 'discover', 'ask for' / 'request', 'go in' / 'enter'.",
   "Subjunctive forms appear in some very formal writing and speech, e.g. 'If I were...' or 'Were they to come...'.",
   "Question tags (e.g. 'He's your friend, isn't he?') are typical of informal speech."]),
 ("Cohesion",
  "Use cohesive devices to link ideas across a text.",
  ["Cohesion links ideas within and across paragraphs so writing flows.",
   "Cohesive devices include adverbials such as 'on the other hand', 'in contrast' and 'as a consequence', and repetition of a key word or phrase.",
   "Ellipsis (leaving out words that can be understood from context) is also a cohesive device."]),
 ("Colons, semicolons and dashes",
  "Use colons, semicolons and dashes correctly.",
  ["A semicolon, colon or dash can mark the boundary between two independent clauses, e.g. 'It's raining; I'm fed up.'",
   "A colon can introduce a list; semicolons can separate items within a list.",
   "Each independent clause could stand alone as a complete sentence."]),
 ("Parenthesis and hyphens",
  "Use parenthesis and hyphens to clarify meaning.",
  ["Parenthesis (extra information) can be marked with brackets, dashes or commas.",
   "Hyphens can be used to avoid ambiguity: 'man eating shark' versus 'man-eating shark', or 'recover' versus 're-cover'.",
   "Removing the parenthesis should still leave a complete sentence."]),
 ("Synonyms and antonyms",
  "Understand how words are related as synonyms and antonyms.",
  ["Synonyms are words with similar meanings, e.g. 'big' and 'large'.",
   "Antonyms are words with opposite meanings, e.g. 'big' and 'little'.",
   "Choosing precise synonyms makes writing clearer and more varied."]),
]

def main():
    conn = psycopg2.connect(DATABASE_URL); conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT subject_id, year_group_id FROM topics WHERE id=%s", (TOPIC,))
    t = cur.fetchone(); sid, ygid = t["subject_id"], t["year_group_id"]

    cur.execute("DELETE FROM curriculum_units WHERE topic_id=%s", (TOPIC,))
    rows = []
    for i,(title,outcome,pts) in enumerate(CHAPTERS):
        content = {"lessons":[{"lessonTitle":title,"pupilLessonOutcome":outcome,
                               "keyLearningPoints":pts,"keywords":[],"misconceptions":[]}],
                   "attribution":ATTR,"canonicalUrl":None}
        rows.append((str(uuid.uuid4()),sid,ygid,TOPIC,title,"",i,None,"high",json.dumps(content)))
    psycopg2.extras.execute_values(cur,
        "INSERT INTO curriculum_units (id,subject_id,year_group_id,topic_id,title,description,order_index,oak_unit_slug,oak_confidence,content_json,content_fetched_at,created_at) VALUES %s",
        rows, template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now(),now())")

    secs = ['<h2>Grammar, Punctuation and Vocabulary</h2>', f'<p><em>{html.escape(ATTR)}</em></p>']
    for title,outcome,pts in CHAPTERS:
        secs.append(f'<h2>{html.escape(title)}</h2>')
        secs.append("<ul>" + "".join(f"<li>{html.escape(p)}</li>" for p in pts) + "</ul>")
    body = "\n".join(secs)
    cur.execute("SELECT id FROM learn_content WHERE topic_id=%s", (TOPIC,))
    lc = cur.fetchone()
    if lc: cur.execute("UPDATE learn_content SET body_html=%s, status='published' WHERE id=%s",(body,lc["id"]))
    else:  cur.execute("INSERT INTO learn_content (id,topic_id,body_html,status) VALUES (%s,%s,%s,'published')",(str(uuid.uuid4()),TOPIC,body))

    cur.execute("DELETE FROM curriculum_chunks WHERE subject=%s AND year_group=%s AND source_name=%s",(SUBJECT,YEAR,SOURCE))
    n=0
    for title,outcome,pts in CHAPTERS:
        chunk = f"[English year-10] Grammar, punctuation and vocabulary — {title}.\n" + "\n".join("- "+p for p in pts)
        emb = embed_text(chunk)
        if emb is None: raise SystemExit("embed failed")
        cur.execute("INSERT INTO curriculum_chunks (id,subject,year_group,source_name,chunk_text,embedding) VALUES (%s,%s,%s,%s,%s,%s::vector)",
                    (str(uuid.uuid4()),SUBJECT,YEAR,SOURCE,chunk,str(emb.tolist())))
        n+=1
    conn.commit()
    print(f"OK: {len(rows)} chapters, learn rebuilt, {n} DfE grammar chunks. Topic still UNPUBLISHED.")
    cur.close(); conn.close()

if __name__ == "__main__":
    main()
