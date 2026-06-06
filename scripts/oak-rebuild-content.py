#!/usr/bin/env python3
"""
oak-rebuild-content.py — Full Oak NA content rebuild

TWO PHASES per run:

Phase A — Topics that ALREADY have curriculum_units (chapters) with oak_unit_slugs.
  For each chapter (Oak unit), fetch its lessons → fetch each lesson's transcript +
  summary → rebuild learn_content.body_html from the transcripts. Also import exit
  quiz questions.

Phase B — Topics that have NO curriculum_units yet.
  Match each DB topic to the closest Oak unit (by normalised title, same year+subject).
  Create curriculum_unit rows. learn_content + quiz questions follow from Phase A on
  the next run (or pass --both to do it in one go).

Structure produced:
  Topic (parent) → CurriculumUnit (Oak unit = chapter) → chapters page fetches
  lessons live from Oak NA. learn_content.body_html is rebuilt from all Oak lesson
  transcripts for that topic.

Usage (on the DO droplet):
  python3 /tmp/oak-rebuild-content.py --dry-run
  python3 /tmp/oak-rebuild-content.py --phase a            # enrich existing chapters only
  python3 /tmp/oak-rebuild-content.py --phase b            # match + create new chapters only
  python3 /tmp/oak-rebuild-content.py --phase both         # default: run A then B
  python3 /tmp/oak-rebuild-content.py --subject Maths English
  python3 /tmp/oak-rebuild-content.py --years year-7 year-8
  python3 /tmp/oak-rebuild-content.py --skip-quiz          # skip quiz import
  python3 /tmp/oak-rebuild-content.py --skip-content       # skip body_html update
  python3 /tmp/oak-rebuild-content.py --min-score 0.20     # lower match threshold
"""
from __future__ import annotations
import argparse, json, os, re, sys, time, uuid, html as html_lib, urllib.request, urllib.parse, subprocess
from collections import defaultdict

# ── Env setup ────────────────────────────────────────────────────────────────
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

OAK_BASE     = "https://open-api.thenational.academy/api/v0"
OAK_KEY      = os.environ.get("OAK_API_KEY", "").strip().strip('"')
DATABASE_URL = os.environ["DATABASE_URL"]

SUBJECT_MAP = {
    "Maths": "maths", "English": "english", "Science": "science",
    "History": "history", "Geography": "geography",
    "Computing": "computing", "French": "french",
    "Spanish": "spanish", "German": "german",
}
YEAR_TO_KS = {
    "year-1": "ks1", "year-2": "ks1",
    "year-3": "ks2", "year-4": "ks2", "year-5": "ks2", "year-6": "ks2",
    "year-7": "ks3", "year-8": "ks3", "year-9": "ks3",
    "year-10": "ks4", "year-11": "ks4",
}
RATE_FLOOR = 20
SLEEP = 0.2

# ── Helpers ───────────────────────────────────────────────────────────────────

STOPWORDS = {"the","a","an","and","or","of","in","to","for","how","what","why",
             "is","are","was","were","did","do","does","have","has","had","it",
             "its","this","that","which","who","where","when","about","with"}

def norm(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    tokens = [t for t in s.split() if t not in STOPWORDS and len(t) > 1]
    return " ".join(tokens)

def similarity(a: str, b: str) -> float:
    ta, tb = set(norm(a).split()), set(norm(b).split())
    if not ta or not tb: return 0.0
    return len(ta & tb) / max(len(ta), len(tb))

def oak(path: str, retries: int = 4) -> object:
    url = path if path.startswith("http") else f"{OAK_BASE}{path}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {OAK_KEY}", "User-Agent": "Decifer-Learning/2.0"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as ex:
            if ex.code in (400, 404): return None
            if ex.code in (429, 503):
                w = 60*(attempt+1); print(f"  Rate limited — sleeping {w}s"); time.sleep(w)
            else:
                time.sleep(3*(attempt+1))
        except Exception:
            time.sleep(2*(attempt+1))
    return None

def check_rate():
    rl = oak("/rate-limit")
    if rl and isinstance(rl, dict) and rl.get("remaining", 999) < RATE_FLOOR:
        reset_ms = rl.get("reset", 0)
        wait = max(30, int(reset_ms/1000 - time.time()) + 5) if reset_ms else 120
        print(f"  Low rate ({rl.get('remaining')}) — sleeping {wait}s"); time.sleep(wait)

def get_lessons_for_unit(ks: str, subj_slug: str, unit_slug: str) -> list[dict]:
    check_rate()
    groups = oak(f"/key-stages/{ks}/subject/{subj_slug}/lessons?unit={urllib.parse.quote(unit_slug)}")
    if not groups or not isinstance(groups, list): return []
    lessons = []
    for g in groups: lessons.extend(g.get("lessons", []))
    return lessons

# ── Transcript → HTML ─────────────────────────────────────────────────────────

def lesson_to_html(summary_data: object, transcript_data: object) -> str:
    parts = []
    if isinstance(summary_data, dict):
        klps = summary_data.get("keyLearningPoints") or []
        if klps:
            parts.append("<h3>Key Learning Points</h3><ul>")
            for k in klps:
                pt = html_lib.escape(str(k.get("keyLearningPoint","")).strip())
                if pt: parts.append(f"<li>{pt}</li>")
            parts.append("</ul>")
        kws = summary_data.get("keywords") or []
        if kws:
            parts.append("<h3>Key Vocabulary</h3><dl>")
            for kw in kws[:10]:
                word = html_lib.escape(str(kw.get("keyword","")).strip())
                desc = html_lib.escape(str(kw.get("description","")).strip())
                if word:
                    parts.append(f"<dt><strong>{word}</strong></dt>")
                    if desc: parts.append(f"<dd>{desc}</dd>")
            parts.append("</dl>")
    if isinstance(transcript_data, dict):
        raw = transcript_data.get("transcript") or transcript_data.get("content") or ""
        if isinstance(raw, list):
            for block in raw:
                if isinstance(block, dict):
                    text = block.get("content") or block.get("text") or ""
                    if isinstance(text, str) and text.strip():
                        parts.append(f"<p>{html_lib.escape(text.strip())}</p>")
        elif isinstance(raw, str):
            for para in re.split(r"\n{2,}", raw.strip()):
                if len(para.strip()) > 40:
                    parts.append(f"<p>{html_lib.escape(para.strip())}</p>")
    return "\n".join(parts)

def build_body_html(unit_lessons_data: list[dict]) -> str:
    """Each item: {unit_title, lessons: [{lesson, html}, ...]}"""
    sections = []
    for ud in unit_lessons_data:
        unit_title = html_lib.escape(ud["unit_title"])
        sections.append(f"<h2>{unit_title}</h2>")
        for ld in ud["lessons"]:
            lesson_title = html_lib.escape(ld["lesson"].get("lessonTitle","Lesson"))
            content = ld.get("html","")
            sections.append(f"<h3>{lesson_title}</h3>")
            if content:
                sections.append(content)
            else:
                sections.append("<p>Content for this lesson is coming soon.</p>")
        sections.append("<hr>")
    return "\n".join(sections)

# ── Quiz import ───────────────────────────────────────────────────────────────

def infer_tier(year: str) -> str:
    if year in ("year-1","year-2","year-3","year-4"): return "sprout"
    if year in ("year-5","year-6","year-7","year-8"): return "explorer"
    return "lightning"

def infer_qtype(subject: str, title: str) -> str:
    t = title.lower()
    if subject=="Maths":
        if any(k in t for k in ["algebra","equation","sequence","quadratic"]): return "maths_algebra"
        if any(k in t for k in ["geometry","angle","shape","circle","area","perimeter"]): return "maths_geometry"
        return "maths_arithmetic"
    if subject=="English":
        if any(k in t for k in ["grammar","punctuation","spelling","vocabulary"]): return "english_grammar"
        return "english_comprehension"
    if subject=="Science":
        if any(k in t for k in ["force","energy","electricity","wave","pressure"]): return "science_physics_calculation"
        if any(k in t for k in ["element","compound","reaction","atom","chemistry"]): return "science_chemistry_equation"
        return "biology_factual"
    return f"{subject.lower()}_factual"

def import_questions(cur, topic_id, year, subject, lessons_data, dry_run) -> int:
    n = 0
    tier = infer_tier(year)
    for ld in lessons_data:
        lesson = ld["lesson"]
        for q in (lesson.get("exitQuiz") or []):
            qtext = q.get("questionStem") or q.get("question") or ""
            if not qtext or not isinstance(qtext, str): continue
            answers = q.get("answers") or []
            def get_text(a):
                if isinstance(a, dict):
                    return (a.get("answer") or {}).get("text") or a.get("text") or ""
                return str(a)
            correct = [a for a in answers if a.get("isCorrect") or (isinstance(a.get("answer"),dict) and a["answer"].get("isCorrect"))]
            wrong   = [a for a in answers if not (a.get("isCorrect") or (isinstance(a.get("answer"),dict) and a["answer"].get("isCorrect")))]
            if not correct: continue
            distractors = [get_text(w) for w in wrong[:3]]
            if not distractors: continue
            if not dry_run:
                cur.execute("""
                    INSERT INTO quiz_questions
                      (id, topic_id, tier, question_text, question_type,
                       correct_answer, distractors, confidence_score, status, created_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,88.0,'published',NOW())
                    ON CONFLICT DO NOTHING
                """, (str(uuid.uuid4()), topic_id, tier,
                      qtext[:1000], infer_qtype(subject, lesson.get("lessonTitle","")),
                      get_text(correct[0])[:500], json.dumps(distractors)))
            n += 1
    return n

# ── Phase A — enrich topics that already have curriculum_units ────────────────

def phase_a(cur, topics_by_id, args, stats):
    print(f"\n{'='*60}\nPHASE A — Enrich existing chapters with content\n{'='*60}")

    cur.execute("""
        SELECT cu.id, cu.topic_id, cu.title, cu.oak_unit_slug, cu.order_index
        FROM   curriculum_units cu
        WHERE  cu.oak_unit_slug IS NOT NULL
        ORDER  BY cu.topic_id, cu.order_index
    """)
    all_cus = cur.fetchall()

    # Group by topic
    by_topic = defaultdict(list)
    for cu in all_cus:
        by_topic[cu["topic_id"]].append(cu)

    for topic_id, cus in by_topic.items():
        topic = topics_by_id.get(topic_id)
        if not topic:
            print(f"  skip (unpublished topic {topic_id})")
            continue
        if args.subject and topic["subject_name"].lower() not in [s.lower() for s in args.subject]:
            continue

        print(f"\n  Topic: {topic['title'][:60]} [{topic['year_label']}]")
        oak_slug = SUBJECT_MAP.get(topic["subject_name"])
        ks = YEAR_TO_KS.get(topic["year_label"])
        if not oak_slug or not ks:
            print(f"    skip (no Oak mapping)")
            continue

        unit_lessons_data = []
        all_lessons_flat = []

        for cu in cus:
            # oak_unit_slug format: "history/ks3/year-7/{unit-slug}"
            parts = cu["oak_unit_slug"].split("/")
            unit_slug = parts[-1] if len(parts) >= 4 else ""
            if not unit_slug:
                continue

            print(f"    Chapter: {cu['title'][:50]}")
            lessons = get_lessons_for_unit(ks, oak_slug, unit_slug)
            if not lessons:
                print(f"      ! no lessons found")
                continue

            print(f"      {len(lessons)} lessons")
            lesson_data_list = []
            for lesson in lessons:
                ls = lesson.get("lessonSlug","")
                time.sleep(SLEEP)
                transcript = oak(f"/lessons/{ls}/transcript")
                summary    = oak(f"/lessons/{ls}/summary")
                lhtml = lesson_to_html(summary, transcript)
                # grab quiz questions too
                if not args.skip_quiz:
                    qdata = oak(f"/lessons/{ls}/questions")
                    if qdata:
                        lesson = {**lesson,
                                  "exitQuiz": qdata.get("exitQuiz",[]),
                                  "starterQuiz": qdata.get("starterQuiz",[])}
                lesson_data_list.append({"lesson": lesson, "html": lhtml})
                time.sleep(SLEEP)

            unit_lessons_data.append({
                "unit_title": cu["title"],
                "lessons": lesson_data_list,
            })
            all_lessons_flat.extend(lesson_data_list)

        if not args.skip_content and unit_lessons_data:
            body = build_body_html(unit_lessons_data)
            if body and not args.dry_run:
                cur.execute("""
                    UPDATE learn_content SET body_html=%s
                    WHERE topic_id=%s AND status='published'
                """, (body, topic_id))
                if cur.rowcount == 0:
                    cur.execute("""
                        INSERT INTO learn_content (id,topic_id,body_html,status,created_at)
                        VALUES (%s,%s,%s,'published',NOW()) ON CONFLICT DO NOTHING
                    """, (str(uuid.uuid4()), topic_id, body))
            print(f"    → learn_content: {len(body)} chars")
            stats["content_updated"] += 1

        if not args.skip_quiz and all_lessons_flat:
            n = import_questions(cur, topic_id, topic["year_label"], topic["subject_name"], all_lessons_flat, args.dry_run)
            if n: print(f"    → {n} quiz questions")
            stats["questions_added"] += n

        if not args.dry_run:
            cur.connection.commit()

# ── Phase B — match topics without curriculum_units to Oak units ──────────────

def phase_b(cur, topics_by_id, args, stats):
    print(f"\n{'='*60}\nPHASE B — Match unmatched topics to Oak units\n{'='*60}")

    # Topics that already have curriculum_units
    cur.execute("SELECT DISTINCT topic_id FROM curriculum_units")
    already_done = {r["topic_id"] for r in cur.fetchall()}

    unmatched = [t for t in topics_by_id.values()
                 if t["id"] not in already_done]
    if args.subject:
        subj_filter = [s.lower() for s in args.subject]
        unmatched = [t for t in unmatched if t["subject_name"].lower() in subj_filter]
    if args.years:
        unmatched = [t for t in unmatched if t["year_label"] in args.years]

    print(f"  {len(unmatched)} topics without chapters")

    # Group by subject+KS to minimise Oak API calls
    by_subj_ks = defaultdict(list)
    for t in unmatched:
        ks = YEAR_TO_KS.get(t["year_label"])
        if ks: by_subj_ks[(t["subject_name"], ks)].append(t)

    for (subject_name, ks), topics in sorted(by_subj_ks.items()):
        oak_slug = SUBJECT_MAP.get(subject_name)
        if not oak_slug:
            continue

        print(f"\n  {subject_name} / {ks.upper()} — {len(topics)} topics")

        check_rate()
        raw = oak(f"/key-stages/{ks}/subject/{oak_slug}/units")
        if not raw or not isinstance(raw, list):
            print(f"  ! no units returned"); continue

        # Build flat unit list with year tag
        oak_units: list[dict] = []
        for group in raw:
            ys = group.get("yearSlug","")
            for u in group.get("units",[]):
                oak_units.append({**u, "_year": ys})
        print(f"  Oak has {len(oak_units)} units")

        # Track which Oak units have been claimed this batch (1 unit → 1 topic)
        claimed: set = set()

        for topic in topics:
            year_label = topic["year_label"]
            same_year  = [u for u in oak_units if u.get("_year") == year_label]
            candidates = same_year if same_year else oak_units

            best, best_score = None, 0.0
            for u in candidates:
                if u.get("unitSlug") in claimed: continue
                score = similarity(topic["title"], u.get("unitTitle",""))
                if score > best_score:
                    best_score = score; best = u

            if not best or best_score < args.min_score:
                print(f"  NO MATCH ({best_score:.2f}): {topic['title'][:60]}")
                continue

            unit_slug = best.get("unitSlug","")
            claimed.add(unit_slug)
            oak_path  = f"{oak_slug}/{ks}/{year_label}/{unit_slug}"
            print(f"  MATCH ({best_score:.2f}): {topic['title'][:50]}")
            print(f"    → {best.get('unitTitle','')[:50]}")
            stats["topics_matched"] += 1

            check_rate()
            lessons = get_lessons_for_unit(ks, oak_slug, unit_slug)
            if not lessons:
                print(f"    ! no lessons"); continue
            print(f"    {len(lessons)} lessons")

            lesson_data_list = []
            for i, lesson in enumerate(lessons):
                ls = lesson.get("lessonSlug","")
                cu_id = str(uuid.uuid4())
                if not args.dry_run:
                    cur.execute("""
                        INSERT INTO curriculum_units
                          (id, subject_id, year_group_id, topic_id, title, description,
                           order_index, oak_unit_slug, oak_confidence, created_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'high',NOW())
                        ON CONFLICT (oak_unit_slug) DO UPDATE
                          SET title=EXCLUDED.title, topic_id=EXCLUDED.topic_id,
                              order_index=EXCLUDED.order_index
                    """, (cu_id, topic["subject_id"], topic["year_group_id"],
                          topic["id"],
                          (lesson.get("lessonTitle","Lesson"))[:255],
                          lesson.get("pupilLessonOutcome",""),
                          i, f"{oak_path}/{ls}"))
                stats["chapters_created"] += 1

                time.sleep(SLEEP)
                if not args.skip_content or not args.skip_quiz:
                    transcript = oak(f"/lessons/{ls}/transcript")
                    summary    = oak(f"/lessons/{ls}/summary")
                    lhtml = lesson_to_html(summary, transcript)
                    if not args.skip_quiz:
                        qdata = oak(f"/lessons/{ls}/questions")
                        if qdata:
                            lesson = {**lesson,"exitQuiz":qdata.get("exitQuiz",[])}
                    lesson_data_list.append({"lesson": lesson, "html": lhtml})
                time.sleep(SLEEP)

            # Build body_html
            if not args.skip_content and lesson_data_list:
                unit_data = [{"unit_title": best.get("unitTitle",""), "lessons": lesson_data_list}]
                body = build_body_html(unit_data)
                if body and not args.dry_run:
                    cur.execute("""
                        UPDATE learn_content SET body_html=%s, updated_at=NOW()
                        WHERE topic_id=%s AND status='published'
                    """, (body, topic["id"]))
                    if cur.rowcount == 0:
                        cur.execute("""
                            INSERT INTO learn_content (id,topic_id,body_html,status,created_at)
                            VALUES (%s,%s,%s,'published',NOW()) ON CONFLICT DO NOTHING
                        """, (str(uuid.uuid4()), topic["id"], body))
                print(f"    → learn_content {len(body)} chars")
                stats["content_updated"] += 1

            if not args.skip_quiz and lesson_data_list:
                n = import_questions(cur, topic["id"], year_label, subject_name, lesson_data_list, args.dry_run)
                if n: print(f"    → {n} quiz questions")
                stats["questions_added"] += n

            if not args.dry_run:
                cur.connection.commit()

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run",      action="store_true")
    p.add_argument("--phase",        choices=["a","b","both"], default="both")
    p.add_argument("--subject",      nargs="+")
    p.add_argument("--years",        nargs="+")
    p.add_argument("--skip-quiz",    action="store_true")
    p.add_argument("--skip-content", action="store_true")
    p.add_argument("--min-score",    type=float, default=0.25)
    args = p.parse_args()

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT t.id, t.title, t.year_group_id, t.subject_id,
               yg.label as year_label, s.name as subject_name, s.slug as subject_slug
        FROM   topics t
        JOIN   year_groups yg ON yg.id = t.year_group_id
        JOIN   subjects     s  ON s.id  = t.subject_id
        WHERE  t.is_published = true
    """)
    topics_by_id = {r["id"]: r for r in cur.fetchall()}
    print(f"Loaded {len(topics_by_id)} published topics")

    stats = {"topics_matched":0,"chapters_created":0,"content_updated":0,"questions_added":0}

    if args.phase in ("a","both"):
        phase_a(cur, topics_by_id, args, stats)
    if args.phase in ("b","both"):
        phase_b(cur, topics_by_id, args, stats)

    print(f"\n{'='*60}")
    print("DONE" + (" (DRY RUN)" if args.dry_run else ""))
    print(f"  Topics matched/enriched: {stats['topics_matched']}")
    print(f"  Chapters created:        {stats['chapters_created']}")
    print(f"  Content updated:         {stats['content_updated']}")
    print(f"  Quiz questions added:    {stats['questions_added']}")
    print(f"{'='*60}")

    cur.close(); conn.close()

if __name__ == "__main__":
    main()
