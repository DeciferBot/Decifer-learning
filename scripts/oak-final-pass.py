#!/usr/bin/env python3
"""
oak-final-pass.py — Two jobs in one:

1. MATCH  — Use Claude to match the remaining topics (no chapters) to Oak units.
             Falls back to Oak /questions endpoint to also pull quiz questions.
2. QUIZ   — For topics that already have chapters, import quiz questions from
             Oak /questions endpoint (fixes the 0-quiz bug from oak-rebuild-content).

Usage (DO droplet):
  python3 /tmp/oak-final-pass.py --dry-run
  python3 /tmp/oak-final-pass.py --job match          # Claude matching only
  python3 /tmp/oak-final-pass.py --job quiz           # Quiz import for existing chapters
  python3 /tmp/oak-final-pass.py --job both           # default
  python3 /tmp/oak-final-pass.py --subject History
"""
from __future__ import annotations
import argparse, json, os, re, sys, time, uuid, html as html_lib, urllib.request, urllib.parse, subprocess
from collections import defaultdict

# ── Env ───────────────────────────────────────────────────────────────────────
_e = subprocess.run(
    ["bash","-c","set -a && source /root/decifer-learning/.env.local && set +a && env"],
    capture_output=True, text=True).stdout
for line in _e.splitlines():
    if "=" in line:
        k,_,v = line.partition("="); os.environ.setdefault(k.strip(), v.strip())
if not os.environ.get("DATABASE_URL") and os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

import psycopg2, psycopg2.extras, anthropic

OAK_BASE     = "https://open-api.thenational.academy/api/v0"
OAK_KEY      = os.environ.get("OAK_API_KEY","").strip().strip('"')
DATABASE_URL = os.environ["DATABASE_URL"]
claude       = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

SUBJECT_MAP = {
    "Maths":"maths","English":"english","Science":"science",
    "History":"history","Geography":"geography","Computing":"computing",
    "French":"french","Spanish":"spanish","German":"german",
}
YEAR_TO_KS = {
    "year-1":"ks1","year-2":"ks1",
    "year-3":"ks2","year-4":"ks2","year-5":"ks2","year-6":"ks2",
    "year-7":"ks3","year-8":"ks3","year-9":"ks3",
    "year-10":"ks4","year-11":"ks4",
}
SLEEP = 0.2
# Proactive rate-limit pacing: 1000 req/hr = 3.6s per request.
# We target 900/hr (conservative) = 4.0s min gap between requests.
_MIN_INTERVAL = 4.0
_last_oak_call = 0.0

# ── Local cache (DB-backed) ───────────────────────────────────────────────────
# Stores raw JSON for expensive Oak lesson endpoints so re-runs are instant.
_oak_cache: dict = {}  # slug -> data, loaded from oak_lesson_cache table if it exists

def _ensure_cache_table(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS oak_lesson_cache (
            slug TEXT PRIMARY KEY,
            endpoint TEXT NOT NULL,
            data JSONB NOT NULL,
            fetched_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

def _cache_get(cur, slug: str, endpoint: str):
    key = f"{endpoint}::{slug}"
    if key in _oak_cache:
        return _oak_cache[key]
    cur.execute("SELECT data FROM oak_lesson_cache WHERE slug=%s AND endpoint=%s", (slug, endpoint))
    row = cur.fetchone()
    if row:
        _oak_cache[key] = row[0]
        return row[0]
    return None

def _cache_set(cur, slug: str, endpoint: str, data):
    key = f"{endpoint}::{slug}"
    _oak_cache[key] = data
    cur.execute("""
        INSERT INTO oak_lesson_cache (slug, endpoint, data)
        VALUES (%s,%s,%s)
        ON CONFLICT (slug) DO UPDATE SET data=EXCLUDED.data, fetched_at=NOW()
    """, (slug, endpoint, json.dumps(data)))

# ── Oak helpers ───────────────────────────────────────────────────────────────

def oak(path, retries=4):
    global _last_oak_call
    # Proactive pacing — never exceed 900 req/hr
    elapsed = time.time() - _last_oak_call
    if elapsed < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - elapsed)
    _last_oak_call = time.time()

    url = path if path.startswith("http") else f"{OAK_BASE}{path}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {OAK_KEY}", "User-Agent": "Decifer/3.0"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as ex:
            if ex.code in (400,404): return None
            if ex.code in (429,503):
                w = 300*(attempt+1); print(f"  rate limit — sleeping {w}s"); time.sleep(w)
            else:
                time.sleep(3*(attempt+1))
        except Exception:
            time.sleep(2*(attempt+1))
    return None

def oak_cached(cur, slug: str, endpoint: str):
    """Fetch an Oak lesson endpoint, using DB cache to avoid re-fetching."""
    cached = _cache_get(cur, slug, endpoint)
    if cached is not None:
        return cached
    path = f"/lessons/{slug}/{endpoint}"
    data = oak(path)
    if data is not None:
        _cache_set(cur, slug, endpoint, data)
    return data

def check_rate():
    pass  # Replaced by proactive pacing — no longer needed

# ── Quiz question parsing (correct Oak format) ────────────────────────────────

def parse_quiz_questions(lessons_with_quizzes: list, topic_id: str, year: str, subject: str) -> list:
    """Parse Oak /questions format: answers have {content, distractor: bool}"""
    out = []
    tier = ("sprout" if year in ("year-1","year-2","year-3","year-4")
            else "explorer" if year in ("year-5","year-6","year-7","year-8")
            else "lightning")
    def qtype(title):
        t = title.lower()
        if subject=="Maths":
            if any(k in t for k in ["algebra","equation","sequence","quadratic"]): return "maths_algebra"
            if any(k in t for k in ["geometry","angle","shape","circle","area","perimeter"]): return "maths_geometry"
            return "maths_arithmetic"
        if subject=="English":
            return "english_grammar" if any(k in t for k in ["grammar","punctuation","spelling","vocabulary"]) else "english_comprehension"
        if subject=="Science":
            if any(k in t for k in ["force","energy","electricity","wave","pressure"]): return "science_physics_calculation"
            if any(k in t for k in ["element","compound","reaction","atom","chemistry"]): return "science_chemistry_equation"
            return "biology_factual"
        return f"{subject.lower()}_factual"

    for lesson in lessons_with_quizzes:
        lesson_title = lesson.get("lessonTitle","")
        qt = qtype(lesson_title)
        for quiz_type in ("exitQuiz","starterQuiz"):
            for q in (lesson.get(quiz_type) or []):
                qtext = q.get("question","").strip()
                if not qtext: continue
                answers = q.get("answers") or []
                correct  = [a["content"] for a in answers if isinstance(a,dict) and not a.get("distractor",True) and a.get("type")=="text"]
                wrong    = [a["content"] for a in answers if isinstance(a,dict) and a.get("distractor",False) and a.get("type")=="text"]
                if not correct or not wrong: continue
                out.append({
                    "id": str(uuid.uuid4()),
                    "topic_id": topic_id,
                    "tier": tier,
                    "question_text": qtext[:1000],
                    "question_type": qt,
                    "correct_answer": correct[0][:500],
                    "distractors": json.dumps(wrong[:3]),
                })
    return out

def insert_questions(cur, questions, dry_run):
    if dry_run: return len(questions)
    for q in questions:
        cur.execute("""
            INSERT INTO quiz_questions
              (id, topic_id, tier, question_text, question_type,
               correct_answer, distractors, confidence_score, status, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,88.0,'published',NOW())
            ON CONFLICT DO NOTHING
        """, (q["id"],q["topic_id"],q["tier"],q["question_text"],
              q["question_type"],q["correct_answer"],q["distractors"]))
    return len(questions)

# ── Transcript / content helpers ──────────────────────────────────────────────

def lesson_html(summary, transcript) -> str:
    parts = []
    if isinstance(summary,dict):
        for kp in (summary.get("keyLearningPoints") or []):
            pt = html_lib.escape(str(kp.get("keyLearningPoint","")).strip())
            if pt: parts.append(f"<li>{pt}</li>")
        if parts:
            parts = ["<h3>Key Learning Points</h3><ul>"] + parts + ["</ul>"]
        kws = summary.get("keywords") or []
        if kws:
            parts.append("<h3>Key Vocabulary</h3><dl>")
            for kw in kws[:8]:
                w = html_lib.escape(str(kw.get("keyword","")).strip())
                d = html_lib.escape(str(kw.get("description","")).strip())
                if w: parts += [f"<dt><strong>{w}</strong></dt>", f"<dd>{d}</dd>" if d else ""]
            parts.append("</dl>")
    if isinstance(transcript,dict):
        raw = transcript.get("transcript") or transcript.get("content") or ""
        if isinstance(raw,list):
            for block in raw:
                if isinstance(block,dict):
                    text = block.get("content") or block.get("text") or ""
                    if isinstance(text,str) and text.strip():
                        parts.append(f"<p>{html_lib.escape(text.strip())}</p>")
        elif isinstance(raw,str):
            for para in re.split(r"\n{2,}", raw.strip()):
                if len(para.strip()) > 40:
                    parts.append(f"<p>{html_lib.escape(para.strip())}</p>")
    return "\n".join(parts)

# ── Claude matching ───────────────────────────────────────────────────────────

def claude_match(topics: list, oak_units: list, subject: str, ks: str) -> list[dict]:
    """Returns [{topic_id, unit_slug, unit_title, confidence}]"""
    topic_list = "\n".join(f"- id:{t['id']} | year:{t['year_label']} | title:{t['title']}" for t in topics)
    unit_list  = "\n".join(f"- slug:{u.get('unitSlug','')} | year:{u.get('_year','')} | title:{u.get('unitTitle','')}" for u in oak_units)

    prompt = f"""Match each Decifer topic to the most appropriate Oak National Academy unit.

Subject: {subject} | Key Stage: {ks.upper()}

DECIFER TOPICS (need matching):
{topic_list}

OAK UNITS (available):
{unit_list}

Rules:
- Match by curriculum content, not just title words. Year group should align.
- Each Oak unit can only match ONE Decifer topic.
- Only include matches you are confident about. Skip a topic if no good match exists.
- KS1=Y1-2, KS2=Y3-6, KS3=Y7-9, KS4=Y10-11

Return ONLY valid JSON, no markdown:
{{"matches":[{{"topic_id":"uuid","unit_slug":"slug","unit_title":"title","confidence":"high|medium"}}]}}"""

    try:
        resp = claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            messages=[{"role":"user","content":prompt}],
        )
        text = resp.content[0].text.strip()
        # Extract JSON
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if not m: return []
        data = json.loads(m.group())
        return data.get("matches",[])
    except Exception as e:
        print(f"    Claude error: {e}")
        return []

# ── JOB: match remaining topics ───────────────────────────────────────────────

def job_match(cur, topics_by_id, args, stats):
    print(f"\n{'='*60}\nJOB: CLAUDE MATCHING for unmatched topics\n{'='*60}")

    cur.execute("SELECT DISTINCT topic_id FROM curriculum_units")
    already_done = {r["topic_id"] for r in cur.fetchall()}

    unmatched = [t for t in topics_by_id.values() if t["id"] not in already_done]
    if args.subject:
        sf = [s.lower() for s in args.subject]
        unmatched = [t for t in unmatched if t["subject_name"].lower() in sf]
    print(f"  {len(unmatched)} topics without chapters")

    by_subj_ks = defaultdict(list)
    for t in unmatched:
        ks = YEAR_TO_KS.get(t["year_label"])
        if ks: by_subj_ks[(t["subject_name"], ks)].append(t)

    for (subject_name, ks), topics in sorted(by_subj_ks.items()):
        oak_slug = SUBJECT_MAP.get(subject_name)
        if not oak_slug: continue

        print(f"\n  {subject_name}/{ks.upper()} — {len(topics)} topics")

        check_rate()
        raw = oak(f"/key-stages/{ks}/subject/{oak_slug}/units")
        if not raw or not isinstance(raw, list): continue

        oak_units = []
        for group in raw:
            ys = group.get("yearSlug","")
            for u in group.get("units",[]): oak_units.append({**u,"_year":ys})

        # Also fetch /questions to get lessons with quiz data
        check_rate()
        q_lessons = oak(f"/key-stages/{ks}/subject/{oak_slug}/questions") or []
        q_by_slug = {l["lessonSlug"]: l for l in q_lessons if "lessonSlug" in l}

        matches = claude_match(topics, oak_units, subject_name, ks)
        print(f"  Claude returned {len(matches)} matches")

        # Build slug→unit lookup
        unit_by_slug = {u.get("unitSlug",""): u for u in oak_units}

        for m in matches:
            topic_id   = m.get("topic_id","")
            unit_slug  = m.get("unit_slug","")
            unit_title = m.get("unit_title","")
            confidence = m.get("confidence","medium")

            topic = topics_by_id.get(topic_id)
            if not topic:
                print(f"  skip unknown topic_id {topic_id}"); continue
            if topic_id in already_done:
                print(f"  skip already-done {topic['title'][:40]}"); continue

            year_label = topic["year_label"]
            oak_path   = f"{oak_slug}/{ks}/{year_label}/{unit_slug}"
            print(f"  MATCHED ({confidence}): {topic['title'][:45]}")
            print(f"    → {unit_title[:50]}")

            # Fetch lessons for this unit
            check_rate()
            lesson_groups = oak(f"/key-stages/{ks}/subject/{oak_slug}/lessons?unit={urllib.parse.quote(unit_slug)}")
            lessons = []
            for grp in (lesson_groups or []):
                lessons.extend(grp.get("lessons",[]))

            if not lessons:
                print(f"    ! no lessons"); continue

            # Fetch transcript + summary per lesson, match quiz questions
            lesson_data = []
            body_sections = []
            for i, lesson in enumerate(lessons):
                ls = lesson.get("lessonSlug","")
                lt = lesson.get("lessonTitle","Lesson")

                cu_id = str(uuid.uuid4())
                if not args.dry_run:
                    cur.execute("""
                        INSERT INTO curriculum_units
                          (id, subject_id, year_group_id, topic_id, title, description,
                           order_index, oak_unit_slug, oak_confidence, created_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                        ON CONFLICT (oak_unit_slug) DO UPDATE
                          SET title=EXCLUDED.title, topic_id=EXCLUDED.topic_id,
                              order_index=EXCLUDED.order_index
                    """, (cu_id, topic["subject_id"], topic["year_group_id"],
                          topic_id, lt[:255], lesson.get("pupilLessonOutcome",""),
                          i, f"{oak_path}/{ls}", confidence))
                stats["chapters"] += 1

                transcript = oak_cached(cur, ls, "transcript")
                summary    = oak_cached(cur, ls, "summary")
                lhtml = lesson_html(summary, transcript)

                # Get quiz questions from /questions endpoint
                q_lesson = q_by_slug.get(ls, lesson)
                lesson_data.append({**q_lesson, "lessonTitle": lt})
                body_sections.append(f"<h3>{html_lib.escape(lt)}</h3>\n{lhtml}")

            # Build learn_content
            body = f"<h2>{html_lib.escape(unit_title)}</h2>\n" + "\n<hr>\n".join(body_sections)
            if not args.dry_run and body:
                cur.execute("UPDATE learn_content SET body_html=%s WHERE topic_id=%s AND status='published'",
                            (body, topic_id))
                if cur.rowcount == 0:
                    cur.execute("INSERT INTO learn_content (id,topic_id,body_html,status,created_at) VALUES (%s,%s,%s,'published',NOW()) ON CONFLICT DO NOTHING",
                                (str(uuid.uuid4()), topic_id, body))
            stats["content"] += 1

            # Import quiz questions
            questions = parse_quiz_questions(lesson_data, topic_id, year_label, subject_name)
            n = insert_questions(cur, questions, args.dry_run)
            if n: print(f"    → {n} quiz Qs, {len(body)} chars content")
            stats["questions"] += n

            already_done.add(topic_id)
            if not args.dry_run: cur.connection.commit()

# ── JOB: import quiz questions for already-chapter topics ────────────────────

def job_quiz(cur, topics_by_id, args, stats):
    print(f"\n{'='*60}\nJOB: QUIZ IMPORT for topics with existing chapters\n{'='*60}")

    cur.execute("SELECT DISTINCT topic_id FROM curriculum_units")
    has_chapters = {r["topic_id"] for r in cur.fetchall()}

    topics = [t for t in topics_by_id.values() if t["id"] in has_chapters]
    if args.subject:
        sf = [s.lower() for s in args.subject]
        topics = [t for t in topics if t["subject_name"].lower() in sf]
    print(f"  {len(topics)} topics with chapters → importing quiz questions")

    by_subj_ks = defaultdict(list)
    for t in topics:
        ks = YEAR_TO_KS.get(t["year_label"])
        if ks: by_subj_ks[(t["subject_name"], ks)].append(t)

    for (subject_name, ks), batch in sorted(by_subj_ks.items()):
        oak_slug = SUBJECT_MAP.get(subject_name)
        if not oak_slug: continue

        print(f"\n  {subject_name}/{ks.upper()} — fetching /questions...")
        check_rate()
        q_lessons = oak(f"/key-stages/{ks}/subject/{oak_slug}/questions")
        if not q_lessons:
            print(f"  ! no questions returned"); continue

        # Map lesson → unit slug (for matching to our curriculum_units)
        check_rate()
        raw = oak(f"/key-stages/{ks}/subject/{oak_slug}/units")
        unit_lessons: dict[str, list] = {}  # unit_slug → [lessonSlugs]
        for group in (raw or []):
            ys = group.get("yearSlug","")
            for u in group.get("units",[]):
                us = u.get("unitSlug","")
                check_rate()
                lgs = oak(f"/key-stages/{ks}/subject/{oak_slug}/lessons?unit={urllib.parse.quote(us)}") or []
                unit_lessons[us] = [l["lessonSlug"] for grp in lgs for l in grp.get("lessons",[])]

        q_by_slug = {l["lessonSlug"]: l for l in q_lessons if "lessonSlug" in l}

        for topic in batch:
            # Find curriculum_units for this topic
            cur.execute("SELECT oak_unit_slug FROM curriculum_units WHERE topic_id=%s", (topic["id"],))
            cu_rows = cur.fetchall()
            if not cu_rows: continue

            # Collect all lesson slugs for this topic's units
            all_lesson_data = []
            for cu in cu_rows:
                oak_unit_slug = cu["oak_unit_slug"] or ""
                # oak_unit_slug format: "subject/ks/year/unit-slug[/lesson-slug]"
                parts = oak_unit_slug.split("/")
                unit_slug = parts[3] if len(parts) >= 4 else parts[-1]
                lesson_slugs = unit_lessons.get(unit_slug, [])
                for ls in lesson_slugs:
                    if ls in q_by_slug:
                        all_lesson_data.append(q_by_slug[ls])

            if not all_lesson_data: continue

            questions = parse_quiz_questions(all_lesson_data, topic["id"], topic["year_label"], subject_name)
            n = insert_questions(cur, questions, args.dry_run)
            if n:
                print(f"  {topic['title'][:50]}: {n} Qs")
                stats["questions"] += n

        if not args.dry_run: cur.connection.commit()

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run",  action="store_true")
    p.add_argument("--job",      choices=["match","quiz","both"], default="both")
    p.add_argument("--subject",  nargs="+")
    args = p.parse_args()

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    _ensure_cache_table(cur); conn.commit()

    cur.execute("""
        SELECT t.id, t.title, t.year_group_id, t.subject_id,
               yg.label as year_label, s.name as subject_name, s.slug as subject_slug
        FROM topics t
        JOIN year_groups yg ON yg.id = t.year_group_id
        JOIN subjects s ON s.id = t.subject_id
        WHERE t.is_published = true
    """)
    topics_by_id = {r["id"]: r for r in cur.fetchall()}
    print(f"Loaded {len(topics_by_id)} topics")

    stats = {"chapters":0,"content":0,"questions":0}

    if args.job in ("match","both"):
        job_match(cur, topics_by_id, args, stats)
    if args.job in ("quiz","both"):
        job_quiz(cur, topics_by_id, args, stats)

    print(f"\n{'='*60}")
    print("DONE" + (" (DRY RUN)" if args.dry_run else ""))
    print(f"  Chapters created:     {stats['chapters']}")
    print(f"  Content updated:      {stats['content']}")
    print(f"  Quiz questions added: {stats['questions']}")
    print(f"{'='*60}")
    cur.close(); conn.close()

if __name__ == "__main__":
    main()
