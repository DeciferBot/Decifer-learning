#!/usr/bin/env python3
"""
oak-full-import.py — Full Oak NA content import

Steps:
1. Fetch all Oak lessons + questions (starter + exit quiz) for KS1/2/3 × 5 subjects
2. Fetch lesson summaries (keywords, learning points, misconceptions)
3. Use Claude Sonnet to match Oak lessons → our topic IDs (batched by KS/subject)
4. Import matched questions directly as published (confidence_score=88.0)
5. Import ALL lesson summaries as curriculum_chunks (better RAG source material)

Usage:
  python3 /tmp/oak-full-import.py --dry-run
  python3 /tmp/oak-full-import.py
  python3 /tmp/oak-full-import.py --chunks-only   # only import chunks, skip questions
  python3 /tmp/oak-full-import.py --questions-only # only import questions, skip chunks
"""
from __future__ import annotations
import argparse, json, os, sys, time, uuid, re, logging, subprocess

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("/tmp/oak-full-import.log"),
    ],
)
log = logging.getLogger(__name__)

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

import urllib.request
import anthropic
import psycopg2, psycopg2.extras

try:
    from sentence_transformers import SentenceTransformer
    _embed_model = SentenceTransformer("all-MiniLM-L6-v2")
except Exception:
    _embed_model = None
    log.warning("sentence-transformers not available — chunks will be imported without embeddings")

# ── Constants ─────────────────────────────────────────────────────────────────
OAK_BASE = "https://open-api.thenational.academy/api/v0"
OAK_KEY  = os.environ.get("OAK_API_KEY", "a1b78391-e9d2-4bf5-b160-47497e15f3b8")

SUBJECTS   = ["maths", "english", "science", "geography", "history"]
KEY_STAGES = ["ks1", "ks2", "ks3"]

KS_TO_YEARS = {
    "ks1": ["year-1", "year-2"],
    "ks2": ["year-3", "year-4", "year-5", "year-6"],
    "ks3": ["year-7", "year-8", "year-9"],
}

OAK_TO_SUBJECT = {
    "maths": "Maths", "english": "English", "science": "Science",
    "geography": "Geography", "history": "History",
}

# Best-effort question type from topic title keywords
def infer_qtype(subject: str, topic_title: str) -> str:
    t = topic_title.lower()
    if subject == "Maths":
        if any(k in t for k in ["algebra", "equation", "expression", "sequence", "function", "quadratic", "simultaneous"]):
            return "maths_algebra"
        if any(k in t for k in ["geometry", "angle", "shape", "circle", "triangle", "area", "perimeter", "pythagoras", "trigonometry", "vector", "position", "direction", "construction"]):
            return "maths_geometry"
        return "maths_arithmetic"
    if subject == "English":
        if any(k in t for k in ["grammar", "punctuation", "spelling", "phonics", "vocabulary", "word"]):
            return "english_grammar"
        if any(k in t for k in ["comprehension", "reading", "inference", "analysis", "literature"]):
            return "english_comprehension"
        return "english_grammar"
    if subject == "Science":
        if any(k in t for k in ["force", "energy", "motion", "electricity", "wave", "light", "sound", "space", "pressure", "magnetism"]):
            return "science_physics_calculation"
        if any(k in t for k in ["element", "compound", "reaction", "atom", "periodic", "chemistry", "acid"]):
            return "science_chemistry_equation"
        return "biology_factual"
    return "science_factual"

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# ── Oak API helpers ────────────────────────────────────────────────────────────
def oak_get(path: str):
    url = path if path.startswith("http") else f"{OAK_BASE}{path}"
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {OAK_KEY}", "User-Agent": "Decifer/2.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as ex:
            if ex.code in (400, 404):
                return None
            time.sleep(2 * (attempt + 1))
        except Exception:
            time.sleep(1 + attempt)
    return None

# ── Step 1: Fetch all Oak content ─────────────────────────────────────────────
def fetch_oak_content() -> dict:
    """Returns {(ks, subject): [enriched_lesson, ...]}"""
    content: dict = {}
    for ks in KEY_STAGES:
        for subj in SUBJECTS:
            log.info(f"Fetching Oak {ks}/{subj}...")
            lessons = oak_get(f"/key-stages/{ks}/subject/{subj}/questions")
            if not lessons:
                log.info(f"  No content for {ks}/{subj}")
                continue
            enriched = []
            for lesson in lessons:
                slug = lesson["lessonSlug"]
                summary = oak_get(f"/lessons/{slug}/summary")
                enriched.append({**lesson, "summary": summary})
                time.sleep(0.15)
            log.info(f"  {len(enriched)} lessons, {sum(len(l.get('starterQuiz',[])) + len(l.get('exitQuiz',[])) for l in enriched)} questions")
            content[(ks, subj)] = enriched
    return content

# ── Step 2: LLM matching ──────────────────────────────────────────────────────
def match_lessons_to_topics(
    oak_lessons: list,
    our_topics: list,
    ks: str,
    subject: str,
) -> dict[str, list[str]]:
    """Returns {oak_slug: [topic_id, ...]} using Claude Sonnet."""
    our_subject = OAK_TO_SUBJECT[subject]
    year_range   = KS_TO_YEARS[ks]

    relevant = [t for t in our_topics
                if t["subject"] == our_subject and t["year_group"] in year_range]
    if not relevant:
        log.info(f"  No topics found for {our_subject} in {year_range}")
        return {}

    oak_list   = "\n".join(f"- slug: {l['lessonSlug']} | title: {l['lessonTitle']}" for l in oak_lessons)
    topic_list = "\n".join(f"- id: {t['id']} | year: {t['year_group']} | title: {t['title']}" for t in relevant)

    prompt = f"""You are matching Oak National Academy lessons to Decifer Learning quiz topics for UK school children.

Subject: {our_subject}
Key Stage: {ks.upper()} (covers years: {', '.join(year_range)})

OAK LESSONS (these contain multiple-choice quiz questions):
{oak_list}

OUR TOPICS (children practise quiz questions on these):
{topic_list}

Task: For each Oak lesson, identify which of our topics its quiz questions would be most relevant and useful for.
Rules:
- One Oak lesson can match 1–3 topics if the content genuinely spans them
- Only match when there is CLEAR curriculum alignment — the Oak questions would actually test that topic
- Consider year group fit: ks1=Y1-2, ks2=Y3-6, ks3=Y7-9. Match to the closest year(s).
- If an Oak lesson has no good match among our topics, omit it from the output
- Prefer HIGH confidence matches — it is better to skip a lesson than to match it wrongly

Return ONLY valid JSON in exactly this format (no markdown, no explanation):
{{
  "matches": [
    {{
      "oak_slug": "lesson-slug",
      "topic_ids": ["uuid1", "uuid2"],
      "confidence": "high",
      "reasoning": "one sentence"
    }}
  ]
}}

Only include matches where confidence is "high" or "medium"."""

    log.info(f"  Calling Claude Sonnet for {ks}/{subject} matching...")
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )
    text = resp.content[0].text.strip()

    # Extract JSON block
    m = re.search(r'\{[\s\S]*\}', text)
    if not m:
        log.warning(f"  No JSON returned for {ks}/{subject}")
        return {}

    try:
        data = json.loads(m.group())
    except json.JSONDecodeError as e:
        log.warning(f"  JSON parse error for {ks}/{subject}: {e}")
        return {}

    result: dict[str, list[str]] = {}
    for match in data.get("matches", []):
        if match.get("topic_ids") and match.get("confidence") in ("high", "medium"):
            result[match["oak_slug"]] = match["topic_ids"]
            log.info(f"    ✓ {match['oak_slug']} → {len(match['topic_ids'])} topic(s) [{match['confidence']}]: {match['reasoning']}")

    log.info(f"  {len(result)}/{len(oak_lessons)} lessons matched")
    return result

# ── Step 3: Parse Oak questions ────────────────────────────────────────────────
def parse_questions(lesson: dict) -> list[dict]:
    """Extract importable multiple-choice questions."""
    questions = []
    for quiz_type in ("starterQuiz", "exitQuiz"):
        quiz = lesson.get(quiz_type, [])
        total = len(quiz)
        for idx, q in enumerate(quiz):
            if q.get("questionType") != "multiple-choice":
                continue
            qt = (q.get("question") or "").strip()
            if not qt:
                continue

            answers = q.get("answers", [])
            correct   = [a["content"] for a in answers if not a.get("distractor") and a.get("type") == "text" and a.get("content")]
            distractors = [a["content"] for a in answers if a.get("distractor") and a.get("type") == "text" and a.get("content")]

            if not correct or len(distractors) < 2:
                continue  # need at least correct + 2 distractors

            questions.append({
                "quiz_type": quiz_type.replace("Quiz", ""),
                "idx": idx,
                "total": total,
                "question_text": qt,
                "correct_answer": correct[0],
                "distractors": distractors[:3],
            })
    return questions

def assign_tier(quiz_type: str, idx: int, total: int) -> str:
    """starter quiz → sprout/explorer; exit quiz → explorer/lightning."""
    if quiz_type == "starter":
        return "sprout" if idx < max(1, total // 2) else "explorer"
    else:
        return "explorer" if idx < max(1, total // 2) else "lightning"

def make_hints(question_text: str, correct_answer: str, keywords: list) -> tuple[str, str, str]:
    """Build 3-level progressive hints."""
    h1 = "Read the question carefully and think about what you know about this topic."
    h2 = "Focus on the key words in the question."
    h3 = f"The answer starts with: {correct_answer[:3]}…" if len(correct_answer) > 3 else f"Think: {correct_answer}"

    if keywords:
        kw = keywords[0]
        h1 = f"Think about: {kw['keyword']}"
        h2 = f"{kw['keyword']} — {kw['description']}"
        if len(keywords) > 1:
            h2 = f"{kw['keyword']}: {kw['description']}"

    return h1, h2, h3

# ── Step 4: DB writes ─────────────────────────────────────────────────────────
def import_questions(
    conn, topic_id: str, topic_title: str, subject: str,
    questions: list, keywords: list, dry_run: bool,
) -> tuple[int, int]:
    imported = skipped = 0
    qtype = infer_qtype(subject, topic_title)

    with conn.cursor() as cur:
        cur.execute(
            "SELECT lower(question_text) FROM quiz_questions WHERE topic_id = %s AND status = 'published'",
            (topic_id,),
        )
        existing = {row[0].strip() for row in cur.fetchall()}

    for q in questions:
        qt = q["question_text"].strip()
        if qt.lower().strip() in existing:
            skipped += 1
            continue

        tier = assign_tier(q["quiz_type"], q["idx"], q["total"])
        h1, h2, h3 = make_hints(qt, q["correct_answer"], keywords)
        explanation = f"The correct answer is: {q['correct_answer']}."

        if dry_run:
            log.info(f"      [DRY] [{tier}] {qt[:70]}…")
            imported += 1
            existing.add(qt.lower().strip())
            continue

        qid = str(uuid.uuid4())
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO quiz_questions
                   (id, topic_id, tier, question_text, question_type,
                    correct_answer, distractors, hint_1, hint_2, hint_3,
                    explanation, confidence_score, status, source_chunk_ids, created_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'published','[]',NOW())
                   ON CONFLICT DO NOTHING""",
                (qid, topic_id, tier, qt, qtype,
                 q["correct_answer"], json.dumps(q["distractors"]),
                 h1, h2, h3, explanation, 88.0),
            )
        conn.commit()
        imported += 1
        existing.add(qt.lower().strip())

    return imported, skipped


def import_chunk(conn, lesson: dict, subject: str, year_groups: list, dry_run: bool) -> int:
    """Import lesson summary as curriculum_chunks for all year groups in the KS."""
    summary = lesson.get("summary")
    if not summary:
        return 0

    our_subject   = OAK_TO_SUBJECT[subject]
    lesson_title  = lesson["lessonTitle"]
    source_name   = f"Oak NA — {lesson_title}"

    parts: list[str] = []
    keywords = summary.get("lessonKeywords", [])
    if keywords:
        parts.append("Key vocabulary:")
        for kw in keywords:
            parts.append(f"  {kw['keyword']}: {kw['description']}")

    for lp in summary.get("keyLearningPoints", []):
        parts.append(f"Learning point: {lp['keyLearningPoint']}")

    outcome = summary.get("pupilLessonOutcome")
    if outcome:
        parts.append(f"Lesson outcome: {outcome}")

    for m in summary.get("misconceptionsAndCommonMistakes", []):
        parts.append(f"Misconception: {m['misconception']} — Correction: {m['response']}")

    if not parts:
        return 0

    chunk_text = "\n".join(parts)
    imported = 0

    for yg in year_groups:
        if dry_run:
            log.info(f"      [DRY] chunk: {source_name} → {yg}")
            imported += 1
            continue

        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM curriculum_chunks WHERE source_name=%s AND year_group=%s",
                (source_name, yg),
            )
            if cur.fetchone():
                continue

            embedding_str = "NULL"
            if _embed_model:
                emb = _embed_model.encode([chunk_text])[0].tolist()
                embedding_str = "[" + ",".join(f"{v:.8f}" for v in emb) + "]"

            if embedding_str == "NULL":
                cur.execute(
                    """INSERT INTO curriculum_chunks (id,subject,year_group,source_name,chunk_text)
                       VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                    (str(uuid.uuid4()), our_subject, yg, source_name, chunk_text),
                )
            else:
                cur.execute(
                    """INSERT INTO curriculum_chunks (id,subject,year_group,source_name,chunk_text,embedding)
                       VALUES (%s,%s,%s,%s,%s,%s::vector) ON CONFLICT DO NOTHING""",
                    (str(uuid.uuid4()), our_subject, yg, source_name, chunk_text, embedding_str),
                )
        conn.commit()
        imported += 1

    return imported

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run",        action="store_true")
    ap.add_argument("--chunks-only",    action="store_true")
    ap.add_argument("--questions-only", action="store_true")
    args = ap.parse_args()

    log.info(f"{'='*60}")
    log.info(f"Oak Full Import — {'DRY RUN' if args.dry_run else 'LIVE'}")
    log.info(f"chunks={'YES' if not args.questions_only else 'NO'}  "
             f"questions={'YES' if not args.chunks_only else 'NO'}")
    log.info(f"{'='*60}")

    conn = psycopg2.connect(os.environ["DATABASE_URL"])

    # Step 1: Fetch all Oak content
    log.info("\n[Step 1] Fetching all Oak content...")
    oak_content = fetch_oak_content()
    total_lessons = sum(len(v) for v in oak_content.values())
    log.info(f"Fetched {total_lessons} lessons")

    # Step 2: Load our topics
    log.info("\n[Step 2] Loading our topics from DB...")
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT t.id, t.title, yg.label AS year_group, s.name AS subject
            FROM topics t
            JOIN year_groups yg ON yg.id = t.year_group_id
            JOIN subjects  s  ON s.id  = t.subject_id
            WHERE t.is_published = true
            ORDER BY s.name, yg.label, t.title
        """)
        our_topics = [dict(r) for r in cur.fetchall()]
    log.info(f"Loaded {len(our_topics)} topics")

    # Step 3 & 4: Match + Import
    total_q_imp = total_q_skip = total_chunks = 0
    all_matches: dict = {}  # (ks,subj,slug) → [topic_ids]

    for (ks, subj), lessons in oak_content.items():
        our_subject  = OAK_TO_SUBJECT[subj]
        year_groups  = KS_TO_YEARS[ks]
        log.info(f"\n{'─'*50}")
        log.info(f"[{ks.upper()} / {our_subject}]  {len(lessons)} lessons")

        # LLM matching for questions
        if not args.chunks_only:
            matches = match_lessons_to_topics(lessons, our_topics, ks, subj)
            all_matches[(ks, subj)] = matches
        else:
            matches = {}

        lesson_by_slug = {l["lessonSlug"]: l for l in lessons}

        # Import questions for matched lessons
        for slug, topic_ids in matches.items():
            lesson   = lesson_by_slug.get(slug)
            if not lesson:
                continue
            keywords = (lesson.get("summary") or {}).get("lessonKeywords", [])
            questions = parse_questions(lesson)

            log.info(f"  [{slug}] {len(questions)} importable Qs → {len(topic_ids)} topic(s)")
            for tid in topic_ids:
                # Find topic title for qtype inference
                topic_title = next((t["title"] for t in our_topics if t["id"] == tid), "")
                qi, qs = import_questions(conn, tid, topic_title, our_subject, questions, keywords, args.dry_run)
                total_q_imp  += qi
                total_q_skip += qs
                log.info(f"    topic {tid[:8]}… → +{qi} imported, {qs} skipped")

        # Import chunks for ALL lessons in this KS/subject (even unmatched)
        if not args.questions_only:
            for lesson in lessons:
                nc = import_chunk(conn, lesson, subj, year_groups, args.dry_run)
                total_chunks += nc

        time.sleep(0.3)  # brief pause between KS/subject batches

    # ── Summary ────────────────────────────────────────────────────────────────
    log.info(f"\n{'='*60}")
    log.info("IMPORT COMPLETE")
    log.info(f"  Questions imported : {total_q_imp}")
    log.info(f"  Questions skipped  : {total_q_skip}  (already existed)")
    log.info(f"  Chunks imported    : {total_chunks}")
    log.info(f"{'='*60}")

    conn.close()

if __name__ == "__main__":
    main()
