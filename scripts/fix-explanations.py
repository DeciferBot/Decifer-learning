#!/usr/bin/env python3
"""
fix-explanations.py — Fix remaining generic explanations using Opus, no JSON.

Asks Opus for plain text explanation only — no JSON parsing, no failures.
"""
from __future__ import annotations
import logging, os, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

_env = Path("/root/decifer-learning/.env.local")
if _env.exists():
    for line in _env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

import psycopg2, psycopg2.extras
import anthropic

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(threadName)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler("/tmp/fix-explanations.log")])
log = logging.getLogger("fix-exp")

_client = None
def _opus():
    global _client
    if not _client:
        _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client

def _conn(): return psycopg2.connect(os.environ["DATABASE_URL"])

def get_questions():
    conn = _conn()
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT qq.id, qq.question_text, qq.correct_answer, qq.distractors,
                   qq.tier, t.title, s.name AS subject, yg.label AS year_group
            FROM quiz_questions qq
            JOIN topics t ON t.id = qq.topic_id
            JOIN subjects s ON s.id = t.subject_id
            JOIN year_groups yg ON yg.id = t.year_group_id
            WHERE qq.status = 'published'
            AND (qq.explanation LIKE 'The correct answer is: %'
                 OR qq.explanation IS NULL OR qq.explanation = '')
        """)
        rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    log.info(f"Found {len(rows)} questions needing explanation fix")
    return rows

def fix_one(q: dict) -> bool:
    prompt = f"""Write a 2-3 sentence educational explanation for this {q['year_group']} {q['subject']} quiz question.

Question: {q['question_text']}
Correct answer: {q['correct_answer']}
Wrong answers: {q['distractors']}
Difficulty tier: {q['tier']}
Topic: {q['title']}

Rules:
- Explain WHY the correct answer is right
- Briefly explain why the wrong answers are incorrect
- Use language appropriate for the year group
- Do NOT start with "The correct answer is"
- Return ONLY the explanation text — no labels, no JSON, no formatting"""

    for attempt in range(3):
        try:
            msg = _opus().messages.create(
                model="claude-opus-4-5",
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}],
            )
            explanation = msg.content[0].text.strip()
            if len(explanation) < 20:
                raise ValueError("Too short")

            conn = _conn()
            with conn.cursor() as cur:
                cur.execute("UPDATE quiz_questions SET explanation = %s WHERE id = %s",
                           (explanation, q["id"]))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            log.warning(f"  Attempt {attempt+1} failed for {q['id'][:8]}: {e}")
            time.sleep(1)
    return False

def main():
    questions = get_questions()
    if not questions:
        log.info("Nothing to fix.")
        return

    log.info(f"Fixing {len(questions)} explanations with Opus — no JSON parsing")
    t0 = time.time()
    fixed = failed = 0

    with ThreadPoolExecutor(max_workers=4, thread_name_prefix="w") as pool:
        futures = {pool.submit(fix_one, q): q for q in questions}
        for i, future in enumerate(as_completed(futures), 1):
            if future.result():
                fixed += 1
            else:
                failed += 1
            if i % 20 == 0:
                log.info(f"[{i}/{len(questions)}] fixed={fixed} failed={failed} "
                         f"ETA={((len(questions)-i)/(i/(time.time()-t0)))/60:.1f}min")

    log.info(f"\nDONE in {(time.time()-t0)/60:.1f}min — fixed={fixed} failed={failed}")

if __name__ == "__main__":
    main()
