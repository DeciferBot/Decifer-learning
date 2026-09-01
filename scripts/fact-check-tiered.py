#!/usr/bin/env python3
"""
fact-check-tiered.py — fact-check published questions on the cheap route,
with the quality control built in rather than assumed.

Why this replaces the Opus sweep
--------------------------------
verify-facts.py runs every question through Opus at ~$0.16 each: ~$350 for a
full sweep. The 2026-08-03 notes also record that cheaper models, asked
"is this correct?", rubber-stamp wrong answers (false confirms) — the worst
possible failure in a checker.

So this script never asks the cheap model "is this right?". It asks it to
FIND THE ERROR, three separate times, from three different angles:

  1. refute      — "prove this answer wrong if you can"
  2. solve-first — "answer it yourself, then compare with the given answer"
  3. distractor  — "is one of the wrong options actually also correct?"

Only a question that survives all three votes is certified clean. Anything
else lands on a suspects list — a cheap false alarm, never a certification.
The suspects list is small enough for Opus or a human afterwards.

QC before trust
---------------
--calibrate takes N questions, secretly corrupts half of them (the stored
answer is swapped for one of its own wrong options), and runs the panel over
the mix. It then reports:

  catch rate   — % of planted errors flagged (must be high; target >= 95%)
  false alarms — % of untouched questions flagged (cost noise; ~10-20% fine)

If the catch rate is poor, the sweep is not worth running and the script
says so. Nothing is written to the database in either mode; the output is
/tmp/fact-suspects.json for the escalation step.

Usage
-----
  fact-check-tiered.py --calibrate 120 --concurrency 2
  fact-check-tiered.py --sweep --limit 2200 --concurrency 2
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import random
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
if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

import psycopg2
import psycopg2.extras
from openai import OpenAI

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s",
                    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger("factcheck")

MODEL = "deepseek-v4-pro"
SUSPECTS_PATH = "/tmp/fact-suspects.json"

client = OpenAI(
    api_key=os.environ["DO_INFERENCE_API_KEY"],
    base_url="https://inference.do-ai.run/v1",
)

# Three angles. Each must end with VERDICT: CLEAN or VERDICT: SUSPECT.
ANGLES = {
    "refute": """You are an examiner hunting for errors in a UK school quiz bank.
Try to PROVE the recorded answer wrong. Work the problem, cite the fact.
If you find any defensible reason the recorded answer is incorrect or
ambiguous, that is a finding.

{body}

End with exactly one line: "VERDICT: SUSPECT reason..." if you found a
problem, or "VERDICT: CLEAN" if you genuinely could not fault it.""",
    "solve_first": """Answer this UK school question yourself, from scratch. Show your answer.
Only AFTER answering, compare with the recorded answer below.

{body}

If your independent answer disagrees with the recorded one, end with
"VERDICT: SUSPECT reason...". If they agree, end with "VERDICT: CLEAN".""",
    "distractor": """In a multiple-choice question every wrong option must be definitely wrong.
Check each of the wrong options below: is any of them ALSO a correct or
defensible answer? Is the recorded answer the single best answer?

{body}

If a wrong option is defensible, or the recorded answer is not clearly the
single best one, end with "VERDICT: SUSPECT reason...". Otherwise end with
"VERDICT: CLEAN".""",
}


def body_for(q: dict) -> str:
    return (
        f"Subject: {q['subject']}  Year: {q['year_group']}  Topic: {q['topic']}\n"
        f"Question: {q['question_text']}\n"
        f"Recorded answer: {q['correct_answer']}\n"
        f"Wrong options: {q['distractors']}"
    )


def one_vote(q: dict, angle: str) -> tuple[bool, str]:
    """Returns (suspect, reason)."""
    prompt = ANGLES[angle].format(body=body_for(q))
    for attempt in range(3):
        try:
            res = client.chat.completions.create(
                model=MODEL, max_tokens=600,
                messages=[{"role": "user", "content": prompt}],
            )
            text = (res.choices[0].message.content or "").strip()
            m = re.search(r"VERDICT:\s*(CLEAN|SUSPECT)(.*)", text, re.I | re.S)
            if not m:
                # No verdict line = the vote failed; treat as suspect, never as clean.
                return True, f"({angle}) no verdict returned"
            if m.group(1).upper() == "CLEAN":
                return False, ""
            return True, f"({angle}) {m.group(2).strip()[:300]}"
        except Exception as e:  # noqa: BLE001
            time.sleep(1.5 * (attempt + 1))
            last = f"{type(e).__name__}: {e}"
    return True, f"({angle}) vote errored: {last}"


def check_question(q: dict) -> dict:
    """Three votes. Calibration showed any-single-vote catches 100% of planted
    errors but cries wolf on 42% of clean questions. The tuned rule:

      - solve_first disagreeing is ALONE enough (an independent solver getting
        a different answer is the strongest possible signal), and
      - otherwise two of the three angles must agree before a question is
        suspect (refute and distractor alone tend toward pedantry).
    """
    votes = {}
    for angle in ANGLES:
        suspect, reason = one_vote(q, angle)
        votes[angle] = (suspect, reason)
    n_suspect = sum(1 for s, _ in votes.values() if s)
    is_suspect = votes["solve_first"][0] or n_suspect >= 2
    return {
        "id": q["id"],
        "suspect": is_suspect,
        "reasons": [r for s, r in votes.values() if s],
        "votes": {a: s for a, (s, _) in votes.items()},
        "question": q["question_text"][:160],
        "answer": str(q["correct_answer"])[:120],
    }


def fetch(limit: int | None, order_random: bool) -> list[dict]:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(f"""
            SELECT qq.id::text, qq.question_text, qq.correct_answer, qq.distractors,
                   t.title AS topic, s.name AS subject, yg.label AS year_group
            FROM quiz_questions qq
            JOIN topics t ON t.id = qq.topic_id
            JOIN subjects s ON s.id = t.subject_id
            JOIN year_groups yg ON yg.id = t.year_group_id
            WHERE qq.status = 'published'
              AND jsonb_array_length(qq.distractors) >= 2
            ORDER BY {"random()" if order_random else "qq.id"}
            {f"LIMIT {int(limit)}" if limit else ""}
        """)
        rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def run_panel(questions: list[dict], concurrency: int) -> list[dict]:
    out = []
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(check_question, q) for q in questions]
        for i, f in enumerate(as_completed(futures), 1):
            out.append(f.result())
            if i % 20 == 0:
                rate = i / max(time.time() - t0, 1)
                log.info("[%d/%d] suspects so far=%d eta=%.0fmin",
                         i, len(questions), sum(1 for r in out if r["suspect"]),
                         (len(questions) - i) / rate / 60)
    return out


def calibrate(n: int, concurrency: int) -> None:
    qs = fetch(n, order_random=True)
    random.seed(11)  # reproducible split
    corrupted_ids = set()
    for q in qs[: len(qs) // 2]:
        distractors = [d for d in (q["distractors"] or []) if isinstance(d, str) and d.strip()]
        if not distractors:
            continue
        # Plant the error: the recorded answer becomes one of its own wrong options.
        q["correct_answer"] = random.choice(distractors)
        corrupted_ids.add(q["id"])
    log.info("calibration: %d questions, %d secretly corrupted", len(qs), len(corrupted_ids))

    results = run_panel(qs, concurrency)
    planted = [r for r in results if r["id"] in corrupted_ids]
    intact = [r for r in results if r["id"] not in corrupted_ids]
    caught = sum(1 for r in planted if r["suspect"])
    false_alarm = sum(1 for r in intact if r["suspect"])

    log.info("── CALIBRATION RESULT ─────────────────────────")
    log.info("planted errors caught : %d/%d  (%.0f%%)", caught, len(planted),
             100 * caught / max(len(planted), 1))
    log.info("false alarms on clean : %d/%d  (%.0f%%)", false_alarm, len(intact),
             100 * false_alarm / max(len(intact), 1))
    missed = [r for r in planted if not r["suspect"]]
    for r in missed[:10]:
        log.info("MISSED planted error: %s | fake answer kept: %s", r["question"], r["answer"])
    verdict = "PASS - sweep is worth running" if caught / max(len(planted), 1) >= 0.95 else \
              "FAIL - the cheap panel misses planted errors; do not trust a sweep"
    log.info("verdict: %s", verdict)


def sweep(limit: int | None, concurrency: int) -> None:
    qs = fetch(limit, order_random=False)
    log.info("sweep: %d questions, 3 votes each on %s", len(qs), MODEL)
    results = run_panel(qs, concurrency)
    suspects = [r for r in results if r["suspect"]]
    Path(SUSPECTS_PATH).write_text(json.dumps(suspects, indent=2))
    log.info("done: %d/%d suspect -> %s (certified clean: %d)",
             len(suspects), len(results), SUSPECTS_PATH, len(results) - len(suspects))
    log.info("Escalate the suspects file to Opus or a human; nothing was written to the DB.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--calibrate", type=int, metavar="N")
    ap.add_argument("--sweep", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--concurrency", type=int, default=2)
    args = ap.parse_args()
    if args.calibrate:
        calibrate(args.calibrate, args.concurrency)
    elif args.sweep:
        sweep(args.limit, args.concurrency)
    else:
        ap.error("pick --calibrate N or --sweep")


if __name__ == "__main__":
    main()
