"""
Directly import Oak NA quiz Q&As as published quiz_questions.

Used for topics where the pipeline keeps failing (visual/spatial topics where
text-based generation scores too low) but Oak has good text Q&As with verified
correct answers and distractors.

Each Q&A is mapped to:
  - question_type: maths_geometry (or override via --type)
  - tier: sprout (Oak questions are generally accessible level)
  - correct_answer: first correct text answer
  - distractors: wrong text answers (up to 3)
  - confidence_score: 88.0 (Oak-verified, treat as high confidence)
  - status: published (directly — no pipeline needed)
  - source_chunk_ids: [] (Oak quiz, not RAG-grounded)

Usage:
  python3 scripts/import-oak-questions-direct.py --dry-run
  python3 scripts/import-oak-questions-direct.py
"""
from __future__ import annotations
import argparse, json, os, sys, time, uuid, urllib.request, urllib.parse, subprocess, re

_e = subprocess.run(
    ["bash", "-c", "set -a && source /root/decifer-learning/.env.local && set +a && env"],
    capture_output=True, text=True).stdout
for line in _e.splitlines():
    if "=" in line:
        k, _, v = line.partition("="); os.environ.setdefault(k, v)
if not os.environ.get("DATABASE_URL") and os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

sys.path.insert(0, "/root/decifer-learning/services/content-pipeline")
import config
import psycopg2, psycopg2.extras

OAK_BASE = "https://open-api.thenational.academy/api/v0"
OAK_KEY  = os.environ.get("OAK_API_KEY", "").strip().strip('"')

# Topics to import: (topic_slug_in_our_db, ks, year_slug, oak_unit_slug, question_type, tier_map)
# tier_map: how many questions to assign to each tier (sprout/explorer/lightning)
IMPORT_TARGETS = [
    {
        "topic_slug":  "year-1-maths-geometry-position-and-direction",
        "ks":          "ks1",
        "year":        "year-1",
        "unit_slug":   "position-and-direction-including-fractions-of-turns",
        "question_type": "maths_geometry",
        "hint_template": "Think about the direction: left, right, up, down, or a turn.",
    },
    {
        "topic_slug":  "year-4-maths-geometry-position-and-direction",
        "ks":          "ks2",
        "year":        "year-4",
        "unit_slug":   "coordinates",
        "question_type": "maths_geometry",
        "hint_template": "Use the grid. Remember: x-coordinate first (across), then y-coordinate (up).",
    },
]


def oak(path: str):
    url = path if path.startswith("http") else f"{OAK_BASE}{path}"
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {OAK_KEY}", "User-Agent": "Decifer/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as ex:
            if ex.code in (400, 404): return None
            if ex.code in (429, 500, 502, 503): time.sleep(2 * (attempt + 1)); continue
            raise
        except Exception: time.sleep(1); continue
    return None


def assign_tier(idx: int, total: int) -> str:
    """Distribute questions across tiers: first third sprout, mid explorer, last lightning."""
    third = max(1, total // 3)
    if idx < third: return "sprout"
    if idx < 2 * third: return "explorer"
    return "lightning"


def make_hints(question: str, correct: str, hint_template: str):
    """Generate 3-level hints from the question and answer."""
    h1 = hint_template
    h2 = f"Focus on the key words in the question."
    h3 = f"The answer starts with: {correct[:3]}…" if len(correct) > 3 else f"Think: {correct}"
    return h1, h2, h3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--topic", help="Only process this topic slug")
    args = ap.parse_args()

    conn = psycopg2.connect(config.DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    targets = [t for t in IMPORT_TARGETS if not args.topic or t["topic_slug"] == args.topic]
    total_inserted = 0

    for target in targets:
        slug    = target["topic_slug"]
        ks      = target["ks"]
        unit    = target["unit_slug"]
        qtype   = target["question_type"]
        hint_t  = target["hint_template"]

        # Look up topic_id
        cur.execute("SELECT id FROM topics WHERE slug = %s", (slug,))
        row = cur.fetchone()
        if not row:
            print(f"  ! Topic not found: {slug}"); continue
        topic_id = str(row["id"])

        # Check existing published Q count
        cur.execute("SELECT COUNT(*) FROM quiz_questions WHERE topic_id = %s AND status = 'published'", (topic_id,))
        existing = cur.fetchone()[0]
        if existing >= 10 and not args.dry_run:
            print(f"  · {slug}: already has {existing} published Qs — skipping"); continue

        print(f"\n══ {slug} ══")

        # Fetch all lessons in the unit
        lg = oak(f"/key-stages/{ks}/subject/maths/lessons?unit={urllib.parse.quote(unit)}")
        lessons = []
        for g in (lg or []): lessons += g.get("lessons", [])
        print(f"  {len(lessons)} Oak lessons in unit '{unit}'")

        # Collect all text Q&As
        all_qas = []
        for lesson in lessons:
            lslug = lesson["lessonSlug"]
            quiz  = oak(f"/lessons/{lslug}/quiz")
            time.sleep(0.1)
            for section in ("starterQuiz", "exitQuiz"):
                for q in (quiz or {}).get(section, []):
                    question_text = (q.get("question") or "").strip()
                    if not question_text: continue
                    answers = q.get("answers", [])
                    text_ans = [a for a in answers if a.get("type") == "text"]
                    correct_list = [a["content"].strip() for a in text_ans if not a.get("distractor", True)]
                    wrong_list   = [a["content"].strip() for a in text_ans if a.get("distractor", False)]
                    if not correct_list: continue
                    all_qas.append({
                        "question": question_text,
                        "correct":  correct_list[0],
                        "distractors": wrong_list[:3],
                        "lesson": lesson["lessonTitle"],
                    })

        print(f"  {len(all_qas)} usable text Q&As found")

        # Deduplicate by question text
        seen = set()
        unique_qas = []
        for qa in all_qas:
            key = re.sub(r'\s+', ' ', qa["question"].lower().strip())
            if key not in seen:
                seen.add(key)
                unique_qas.append(qa)
        print(f"  {len(unique_qas)} after dedup")

        if args.dry_run:
            for i, qa in enumerate(unique_qas[:5]):
                tier = assign_tier(i, len(unique_qas))
                print(f"    [{tier}] {qa['question'][:70]}")
                print(f"           → {qa['correct']}  |  wrong: {qa['distractors']}")
            print(f"    … and {max(0, len(unique_qas)-5)} more")
            continue

        inserted = 0
        for i, qa in enumerate(unique_qas):
            tier = assign_tier(i, len(unique_qas))
            h1, h2, h3 = make_hints(qa["question"], qa["correct"], hint_t)
            explanation = f"The correct answer is {qa['correct']!r}. {hint_t}"

            cur.execute("""
                INSERT INTO quiz_questions
                  (id, topic_id, tier, question_text, question_type,
                   correct_answer, distractors,
                   hint_1, hint_2, hint_3, explanation,
                   confidence_score, status, source_chunk_ids)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'published','[]')
                ON CONFLICT DO NOTHING
            """, (
                str(uuid.uuid4()), topic_id, tier,
                qa["question"], qtype,
                qa["correct"], json.dumps(qa["distractors"]),
                h1, h2, h3, explanation,
                88.0,
            ))
            inserted += 1

        conn.commit()
        print(f"  ✓ Inserted {inserted} questions for {slug}")
        total_inserted += inserted

        # Mark topic published if it isn't
        cur.execute("UPDATE topics SET is_published = true WHERE id = %s AND is_published = false", (topic_id,))
        conn.commit()

    print(f"\n── {'DRY RUN — ' if args.dry_run else ''}{total_inserted} questions imported ──")


if __name__ == "__main__":
    main()
