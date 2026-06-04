#!/usr/bin/env python3
"""
improve-questions.py — Quality pass over all published questions

Fixes three issues in one batched pass:
  Issue 1: Oak-imported questions have templated hints (Think about: X / X: definition)
  Issue 2: Questions with < 3 distractors — adds a third plausible-but-wrong option
  Issue 4: Generic explanations ("The correct answer is: X.") — rewrites with reasoning

Uses Claude Haiku for all rewrites (cheap, fast, good enough for mechanical improvements).
Processes 5 questions per API call. 8 parallel workers.

Estimated time: ~2,949 questions ÷ 5 per call ÷ 8 workers × 3s/call ≈ 22 minutes

Usage:
  python3 /tmp/improve-questions.py --dry-run
  python3 /tmp/improve-questions.py
  python3 /tmp/improve-questions.py --limit 100   # test on 100 first
"""
from __future__ import annotations
import argparse, json, logging, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

# ── Env ───────────────────────────────────────────────────────────────────────
_env = Path("/root/decifer-learning/.env.local")
if _env.exists():
    for line in _env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

import psycopg2, psycopg2.extras
import anthropic

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(threadName)s] %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("/tmp/improve-questions.log"),
    ],
)
log = logging.getLogger("improve-q")

_client: Optional[anthropic.Anthropic] = None

def _haiku() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client

HAIKU_MODEL = "claude-opus-4-5"

# ── DB ────────────────────────────────────────────────────────────────────────
def _conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def get_questions_needing_improvement(limit: Optional[int]) -> list[dict]:
    """Find all published questions needing any of the 3 fixes."""
    conn = _conn()
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT
                qq.id, qq.question_text, qq.correct_answer, qq.distractors,
                qq.hint_1, qq.hint_2, qq.hint_3, qq.explanation,
                qq.confidence_score, qq.tier, qq.question_type,
                t.title AS topic_title,
                s.name  AS subject,
                yg.label AS year_group
            FROM quiz_questions qq
            JOIN topics      t  ON t.id  = qq.topic_id
            JOIN subjects    s  ON s.id  = t.subject_id
            JOIN year_groups yg ON yg.id = t.year_group_id
            WHERE qq.status = 'published'
            AND (
                -- Issue 1: Oak-imported templated hints
                qq.hint_1 LIKE 'Think about: %'
                OR qq.hint_1 = 'Read the question carefully and think about what you know about this topic.'
                -- Issue 2: fewer than 3 distractors
                OR (
                    jsonb_typeof(qq.distractors) = 'array'
                    AND jsonb_array_length(qq.distractors) < 3
                )
                -- Issue 4: generic explanation
                OR qq.explanation LIKE 'The correct answer is: %'
                OR qq.explanation = ''
                OR qq.explanation IS NULL
            )
            ORDER BY qq.created_at ASC
        """ + (f" LIMIT {limit}" if limit else ""))
        rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    log.info(f"Found {len(rows)} questions needing improvement")
    return rows

def is_thin_distractors(distractors) -> bool:
    if not distractors:
        return True
    if isinstance(distractors, str):
        try:
            distractors = json.loads(distractors)
        except Exception:
            return True
    return isinstance(distractors, list) and len(distractors) < 3

def is_generic_hint(hint_1: str) -> bool:
    generic = [
        "Think about: ",
        "Read the question carefully",
        "Focus on the key words",
    ]
    return any(hint_1.startswith(g) for g in generic)

def is_generic_explanation(explanation: str) -> bool:
    if not explanation:
        return True
    return explanation.strip().startswith("The correct answer is:") and len(explanation.strip()) < 80

# ── Batch improvement ─────────────────────────────────────────────────────────
def improve_batch(questions: list[dict], dry_run: bool) -> int:
    """Improve a batch of up to 5 questions in one Haiku call. Returns count updated."""
    if not questions:
        return 0

    # Build prompt
    items = []
    for i, q in enumerate(questions):
        distractors = q["distractors"]
        if isinstance(distractors, str):
            try:
                distractors = json.loads(distractors)
            except Exception:
                distractors = []
        if not isinstance(distractors, list):
            distractors = []

        needs = []
        if is_generic_hint(q["hint_1"] or ""):
            needs.append("hints")
        if is_thin_distractors(distractors):
            needs.append(f"third_distractor (currently only {len(distractors)})")
        if is_generic_explanation(q["explanation"] or ""):
            needs.append("explanation")

        # Skip if nothing actually needs fixing (false positive from SQL)
        if not needs:
            continue

        items.append({
            "index": len(items) + 1,
            "q_id": q["id"],
            "question": q["question_text"],
            "correct_answer": q["correct_answer"],
            "distractors": distractors,
            "current_hints": [q["hint_1"], q["hint_2"], q["hint_3"]],
            "tier": q["tier"],
            "topic": q["topic_title"],
            "subject": q["subject"],
            "year_group": q["year_group"],
            "needs": needs,
        })

    # If single item, use a simpler non-array prompt to avoid JSON parse issues
    if len(items) == 1:
        it = items[0]
        needs_str = ", ".join(it["needs"])
        prompt = f"""Improve this quiz question for a {it['year_group']} {it['subject']} student.

Question: {it['question']}
Correct answer: {it['correct_answer']}
Distractors: {it['distractors']}
Tier: {it['tier']}
Topic: {it['topic']}

Provide ONLY these improvements: {needs_str}

Rules:
- hints: hint_1=general, hint_2=more specific, hint_3=nearly gives answer but doesn't state it
- explanation: why correct answer is right, briefly why distractors are wrong (2-3 sentences)
- third_distractor: plausible but clearly wrong, same format as existing distractors

Return ONLY this JSON object (no array, no markdown):
{{
  "index": 1,
  "hint_1": "...",
  "hint_2": "...",
  "hint_3": "...",
  "explanation": "...",
  "third_distractor": "..."
}}
Include only fields in: {needs_str}"""
    else:
        prompt = f"""You are improving quiz questions for Decifer Learning, a UK National Curriculum app for children aged 5-14.

For each question below, provide only what is listed in "needs". Do not change anything not listed.

QUESTIONS:
{json.dumps(items, indent=2)}

RULES:
- hints must be PROGRESSIVE: hint_1 is general topic guidance, hint_2 is more specific, hint_3 nearly gives it away but doesn't state the answer directly
- hints must be written FOR THE CHILD (age-appropriate for the year group)
- explanation must say WHY the correct answer is right AND briefly why each distractor is wrong (2-3 sentences)
- third_distractor must be plausible but clearly wrong on reflection — same format/length as existing distractors
- Keep language appropriate for {questions[0]['year_group']} level

Return ONLY a JSON array, one object per question (same order):
[
  {{
    "index": 1,
    "hint_1": "...",
    "hint_2": "...",
    "hint_3": "...",
    "explanation": "...",
    "third_distractor": "..."
  }}
]

Only include fields that are in the question's "needs" list. Omit fields not needed."""

    for attempt in range(3):
        try:
            msg = _haiku().messages.create(
                model=HAIKU_MODEL,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            text = msg.content[0].text.strip()
            text = re.sub(r"```[a-z]*\n?", "", text).strip()
            # Try array first, then single object
            arr_match = re.search(r'\[[\s\S]*\]', text)
            obj_match = re.search(r'\{[\s\S]*\}', text)
            if arr_match:
                improvements = json.loads(arr_match.group())
            elif obj_match:
                # Single object response — wrap in array
                improvements = [json.loads(obj_match.group())]
            else:
                raise ValueError(f"No JSON found: {text[:100]}")
            break
        except json.JSONDecodeError:
            # Try a more aggressive fix: use ast.literal_eval-style repair
            try:
                import ast
                # Replace single quotes used as JSON delimiters
                json_str = re.sub(r"(?<![\\])'", '"', m.group() if m else "[]")
                improvements = json.loads(json_str)
                break
            except Exception:
                pass
            improvements = []
            log.warning(f"  Haiku attempt {attempt+1} failed: JSON parse error")
            time.sleep(1)
        except Exception as e:
            log.warning(f"  Haiku attempt {attempt+1} failed: {e}")
            time.sleep(1)
            improvements = []

    if not improvements:
        return 0

    # Build lookup by index
    item_by_index = {it["index"]: it for it in items}

    # Apply improvements to DB
    updated = 0
    conn = _conn()
    for imp in improvements:
        idx = imp.get("index", 0)
        it = item_by_index.get(idx)
        if not it:
            continue
        # Map back to the original question via q_id
        q = next((q for q in questions if q["id"] == it["q_id"]), None)
        if not q:
            continue

        # Get current distractors
        distractors = q["distractors"]
        if isinstance(distractors, str):
            try:
                distractors = json.loads(distractors)
            except Exception:
                distractors = []
        if not isinstance(distractors, list):
            distractors = []

        # Build update
        updates: dict = {}

        if "hint_1" in imp and imp["hint_1"]:
            updates["hint_1"] = imp["hint_1"]
        if "hint_2" in imp and imp["hint_2"]:
            updates["hint_2"] = imp["hint_2"]
        if "hint_3" in imp and imp["hint_3"]:
            updates["hint_3"] = imp["hint_3"]
        if "explanation" in imp and imp["explanation"]:
            updates["explanation"] = imp["explanation"]
        if "third_distractor" in imp and imp["third_distractor"] and len(distractors) < 3:
            new_distractors = distractors + [imp["third_distractor"]]
            updates["distractors"] = json.dumps(new_distractors)

        if not updates:
            continue

        if dry_run:
            log.info(f"  [DRY] Would update {q['id'][:8]}… ({list(updates.keys())})")
            updated += 1
            continue

        set_clause = ", ".join(f"{k} = %s" for k in updates)
        values = list(updates.values()) + [q["id"]]
        with conn.cursor() as cur:
            cur.execute(f"UPDATE quiz_questions SET {set_clause} WHERE id = %s", values)
        conn.commit()
        updated += 1

    conn.close()
    return updated

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--limit",   type=int, default=None)
    ap.add_argument("--batch-size", type=int, default=5)
    args = ap.parse_args()

    questions = get_questions_needing_improvement(args.limit)
    if not questions:
        log.info("Nothing to improve.")
        return

    # Split into batches
    batches = [questions[i:i+args.batch_size] for i in range(0, len(questions), args.batch_size)]
    log.info(f"{'='*60}")
    log.info(f"Improve Questions — {'DRY RUN' if args.dry_run else 'LIVE'}")
    log.info(f"Questions: {len(questions)} | Batches: {len(batches)} | Workers: {args.workers}")
    log.info(f"{'='*60}")

    t0 = time.time()
    total_updated = 0

    with ThreadPoolExecutor(max_workers=args.workers, thread_name_prefix="worker") as pool:
        futures = {pool.submit(improve_batch, batch, args.dry_run): i
                   for i, batch in enumerate(batches)}
        for done, future in enumerate(as_completed(futures), 1):
            try:
                n = future.result()
                total_updated += n
                if done % 20 == 0:
                    elapsed = time.time() - t0
                    rate = done / elapsed * 60
                    eta = (len(batches) - done) / (rate / 60) if rate > 0 else 0
                    log.info(f"[{done}/{len(batches)}] +{total_updated} updated | "
                             f"rate={rate:.0f} batches/min | ETA={eta/60:.1f}min")
            except Exception as e:
                log.error(f"Batch error: {e}")

    elapsed = time.time() - t0
    log.info(f"\n{'='*60}")
    log.info(f"COMPLETE in {elapsed/60:.1f} minutes")
    log.info(f"  Questions improved: {total_updated}")
    log.info(f"{'='*60}")

if __name__ == "__main__":
    main()
