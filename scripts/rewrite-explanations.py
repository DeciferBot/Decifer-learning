#!/usr/bin/env python3
"""
rewrite-explanations.py — replace explanations that teach nothing.

Why this exists alongside fix-explanations.py
---------------------------------------------
As of 2026-09-01, 7,538 of 16,021 published questions carry an explanation that
just hands the answer back:

    "The correct answer is: '10 more than 55 equals 65'."

A child who got it wrong learns nothing from that. The explanation is the only
place in the whole product where teaching happens after a mistake, so half the
teaching is missing.

fix-explanations.py catches only the 5,545 that literally begin
"The correct answer is: ". This catches the other ~2,000 too: the ones that are
too short to explain anything, and the ones that restate the answer in different
words. It also refuses to write an explanation that could mislead, which the
older script does not check at all.

Safety, because this writes to live content children read
--------------------------------------------------------
Nothing is written unless --write is passed. Default is a dry run that prints
before/after so a person can judge the wording first.

Every candidate explanation must survive these checks or the row is skipped and
counted, never silently written:
  - long enough to contain reasoning
  - does not open with the phrase we are removing
  - mentions the correct answer
  - does NOT assert that a wrong answer is the right one
  - no leaked instructions, labels or JSON

The LLM never decides what the answer IS. It only explains an answer that
already passed the pipeline's verification, which is what CLAUDE.md §16.4
requires.

Usage
-----
  python3 rewrite-explanations.py --limit 8                # dry run, look at it
  python3 rewrite-explanations.py --limit 8 --model opus   # compare quality
  python3 rewrite-explanations.py --write                  # do it for real
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

for _env in (Path("/root/decifer-learning/.env.local"), Path(".env.local")):
    if _env.exists():
        for line in _env.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            v = v.strip().strip('"').strip("'")
            if v:
                os.environ.setdefault(k.strip(), v)
        break

# The pooled connection is for the app. Bulk work uses the direct one.
if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

import psycopg2
import psycopg2.extras

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("rewrite-exp")

# The pipeline's own routes. DeepSeek on DigitalOcean is the primary one and is
# roughly two orders of magnitude cheaper than Anthropic; Sonnet/Opus are here
# so a small batch can be compared side by side before spending on 7,500.
MODELS = {
    "deepseek": ("do", "deepseek-v4-pro"),
    "flash": ("do", "deepseek-4-flash"),
    "opus": ("anthropic", "claude-opus-5"),
    "sonnet": ("anthropic", "claude-sonnet-5"),
}

# An explanation is useless if it only hands back the answer.
CANDIDATE_SQL = """
    SELECT qq.id, qq.question_text, qq.correct_answer, qq.distractors,
           qq.tier, qq.explanation, t.title AS topic,
           s.name AS subject, yg.label AS year_group
    FROM quiz_questions qq
    JOIN topics t       ON t.id  = qq.topic_id
    JOIN subjects s     ON s.id  = t.subject_id
    JOIN year_groups yg ON yg.id = t.year_group_id
    WHERE qq.status = 'published'
      AND (
            qq.explanation IS NULL
         OR length(trim(qq.explanation)) = 0
         OR qq.explanation ILIKE 'the correct answer is%%'
         OR length(qq.explanation) < 40
         OR (position(lower(qq.correct_answer) in lower(qq.explanation)) > 0
             AND length(qq.explanation) < length(qq.correct_answer) + 45)
      )
    ORDER BY qq.id
    %s
"""

PROMPT = """You are writing the explanation a {year} child reads after answering a {subject} question, whether they got it right or wrong. It is the only teaching they get after the attempt, so it has to do real work.

Topic: {topic}
Question: {question}
Correct answer: {answer}
Wrong answers offered: {distractors}

Write 2 to 3 sentences that:
- explain WHY the answer is right, showing the step or the reason, not just the result
- name the most tempting wrong answer and say what mistake leads to it
- use words a {year} child reads comfortably

Write any fractions in plain a/b form (like 4/12) and angles as "0 degrees" — no LaTeX, no markdown, no asterisks.
Never begin with "The correct answer is". Never just restate the answer.
Return only the explanation. No labels, no quotes around the whole thing, no JSON.
"""

BANNED_OPENERS = ("the correct answer is", "the answer is", "correct answer:")


def normalise(s: str) -> str:
    """Make maths-markup answers comparable with prose.

    '{4} \\over {12}' and '4/12' must count as the same thing, and '0ᵒ',
    '0°' and '0 degrees' must too — otherwise the safety check rejects good
    explanations for questions whose answers carry LaTeX, which is exactly
    the maths content that most needs decent explanations.
    """
    t = s.lower()
    # {a} \over {b}  ->  a/b
    t = re.sub(r"\{\s*([^{}]+?)\s*\}\s*\\over\s*\{\s*([^{}]+?)\s*\}", r"\1/\2", t)
    t = t.replace("\\over", "/")
    t = re.sub(r"[{}$\\]", "", t)
    t = t.replace("\u1d52", " degrees").replace("\u00b0", " degrees")
    t = re.sub(r"\s*/\s*", "/", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


STOPWORDS = {
    "the", "and", "was", "were", "are", "for", "with", "that", "this", "from",
    "into", "some", "more", "their", "them", "they", "which", "what", "when",
    "not", "but", "has", "had", "have", "its", "his", "her", "than", "then",
}


def answer_mentioned(answer: str, text: str) -> bool:
    """Does the explanation actually talk about the answer?

    Exact matching alone rejects good work: the answer 'heat it' becomes
    'heating the liquid' in prose, and 'invention of household appliances'
    becomes 'household appliances were invented'. So: exact phrase first,
    then fall back to counting the answer's meaningful words, tolerating
    word endings (invention/invented) but not different words (sheep must
    not match sheepdogs — at most 3 trailing letters of slack).
    """
    a, t = normalise(answer), normalise(text)
    if not a:
        return True
    # Exact phrase, with boundaries so '0 degrees' never matches '10 degrees'.
    if re.search(rf"(?<![0-9a-z]){re.escape(a)}(?![0-9a-z])", t):
        return True

    words = [
        w for w in re.findall(r"[0-9a-z/]+", a)
        if w not in STOPWORDS and (len(w) >= 3 or w.isdigit() or "/" in w)
    ]
    if not words:
        return False
    hits = 0
    for w in words:
        if w.isdigit() or "/" in w:
            if re.search(rf"(?<![0-9a-z]){re.escape(w)}(?![0-9a-z])", t):
                hits += 1
        else:
            stem = w[:5] if len(w) > 5 else w
            # The full word always matches itself; the stem+slack form catches
            # endings (invention/invented) without letting sheep match sheepdogs.
            if re.search(
                rf"(?<![0-9a-z])(?:{re.escape(w)}|{re.escape(stem)}[0-9a-z]{{0,3}})(?![0-9a-z])", t
            ):
                hits += 1
    # Long answers (event orderings) only need to touch on 6 of their words.
    import math
    return hits >= min(math.ceil(len(words) * 0.6), 6)


def get_candidates(limit: int | None) -> list[dict]:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(CANDIDATE_SQL % (f"LIMIT {int(limit)}" if limit else ""))
        rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def call_model(provider: str, model: str, prompt: str) -> str:
    if provider == "anthropic":
        import anthropic

        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        msg = client.messages.create(
            model=model, max_tokens=350, messages=[{"role": "user", "content": prompt}]
        )
        return msg.content[0].text.strip()

    from openai import OpenAI

    client = OpenAI(
        api_key=os.environ["DO_INFERENCE_API_KEY"],
        base_url="https://inference.do-ai.run/v1",
    )
    res = client.chat.completions.create(
        model=model, max_tokens=350, messages=[{"role": "user", "content": prompt}]
    )
    return (res.choices[0].message.content or "").strip()


def is_safe(text: str, q: dict) -> tuple[bool, str]:
    """Refuse anything that could teach a child the wrong thing."""
    t = " ".join(text.split())
    low = t.lower()
    answer = str(q["correct_answer"]).strip()

    if len(t) < 60:
        return False, "too short to explain anything"
    if any(low.startswith(b) for b in BANNED_OPENERS):
        return False, "still opens by restating the answer"
    if re.search(r"\{|\}|```|^explanation\s*:", low):
        return False, "leaked formatting"
    if answer and not answer_mentioned(answer, t):
        return False, "never mentions the correct answer"

    # The hard one: an explanation that calls a wrong option correct.
    distractors = q.get("distractors") or []
    if isinstance(distractors, str):
        distractors = [distractors]
    for d in distractors:
        d = str(d).strip()
        if not d or len(d) < 2:
            continue
        if re.search(
            rf"(?:correct answer is|answer is|right answer is)\s*[:\"'“]*\s*{re.escape(d)}",
            low,
        ):
            return False, f"calls the wrong option '{d}' correct"
    return True, ""


def rewrite_one(q: dict, provider: str, model: str, write: bool) -> dict:
    prompt = PROMPT.format(
        year=q["year_group"].replace("-", " ").title(),
        subject=q["subject"],
        topic=q["topic"],
        question=q["question_text"],
        answer=q["correct_answer"],
        distractors=q["distractors"],
    )
    last = ""
    for attempt in range(3):
        try:
            text = " ".join(call_model(provider, model, prompt).split())
            text = re.sub(r"(?<!\*)\*(?!\*)", "", text.replace("**", ""))
            ok, why = is_safe(text, q)
            if not ok:
                last = why
                continue
            if write:
                conn = psycopg2.connect(os.environ["DATABASE_URL"])
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE quiz_questions SET explanation = %s WHERE id = %s",
                        (text, q["id"]),
                    )
                conn.commit()
                conn.close()
            return {"id": q["id"], "ok": True, "text": text, "before": q["explanation"]}
        except Exception as e:  # noqa: BLE001 — one bad row must not stop 7,500
            last = f"{type(e).__name__}: {e}"
            time.sleep(1.5 * (attempt + 1))
    return {"id": q["id"], "ok": False, "why": last, "before": q["explanation"]}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="deepseek", choices=sorted(MODELS))
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--write", action="store_true", help="actually update the database")
    args = ap.parse_args()

    provider, model = MODELS[args.model]
    rows = get_candidates(args.limit)
    log.info(
        "%d explanations to rewrite | model=%s (%s) | %s",
        len(rows),
        model,
        provider,
        "WRITING TO DATABASE" if args.write else "dry run, nothing will be saved",
    )
    if not rows:
        return

    done = skipped = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(rewrite_one, q, provider, model, args.write) for q in rows]
        for i, f in enumerate(as_completed(futures), 1):
            r = f.result()
            if r["ok"]:
                done += 1
                if not args.write or i <= 5:
                    print(f"\n--- {r['id'][:8]}")
                    print(f"BEFORE: {(r['before'] or '(none)')[:160]}")
                    print(f"AFTER : {r['text'][:400]}")
            else:
                skipped += 1
                log.warning("skipped %s — %s", r["id"][:8], r["why"])
            if args.write and i % 50 == 0:
                rate = i / max(time.time() - t0, 1)
                log.info(
                    "[%d/%d] written=%d skipped=%d eta=%.0fmin",
                    i, len(rows), done, skipped, (len(rows) - i) / rate / 60,
                )

    log.info(
        "done in %.1f min — rewritten=%d skipped=%d%s",
        (time.time() - t0) / 60, done, skipped,
        "" if args.write else " (dry run, nothing saved)",
    )


if __name__ == "__main__":
    main()
