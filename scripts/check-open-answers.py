#!/usr/bin/env python3
"""
check-open-answers.py — the checker for questions with no wrong options:
typed answers, match-the-pairs, and put-in-order.

Why these need their own checker
--------------------------------
fact-check-tiered.py audits multiple-choice by attacking the options. These
~3,400 questions have no options, and each shape fails differently:

  short_answer_text  a child TYPES the answer, and only the accept-list
                     decides if they were right. The killer defect is a
                     missing synonym: the child answers "bloodstream", the
                     list only holds "blood", and a correct child is marked
                     wrong. So the checker asks both "is the accepted answer
                     right?" AND "what other answers deserve to be accepted?"

  match_pairs        every left item must match exactly one right item. The
                     defect is a pairing that is wrong, or a left that could
                     defensibly take two rights.

  ordered_list       the recorded order must be the only defensible order.

Same discipline as the sweep: DeepSeek on the droplet, never asked "is this
fine?" — it derives its own answer first, then compares. Two angles per
question (independent-solve, then refute); suspect when the independent
solve disagrees, or both angles complain. Nothing writes to the database;
suspects go to /tmp/open-suspects.json for the referee or a human.

Proven before trusted: --calibrate secretly corrupts half a sample, one
corruption per shape (wrong word in the accept-list, two rights swapped
between pairs, two neighbours swapped in the order) and measures the catch
rate. No sweep unless it passes.

Usage
-----
  check-open-answers.py --calibrate 120 --concurrency 2
  check-open-answers.py --sweep --concurrency 3
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
log = logging.getLogger("opencheck")

MODEL = "deepseek-v4-pro"
SUSPECTS_PATH = "/tmp/open-suspects.json"
RULE = "either"  # overwritten by --rule

client = OpenAI(
    api_key=os.environ["DO_INFERENCE_API_KEY"],
    base_url="https://inference.do-ai.run/v1",
)

SOLVE = {
    "short_answer_text": """A child must TYPE the answer to this UK school question. Answer it yourself
first, in one or two words, before reading the accepted answers.

Subject: {subject}  Year: {year_group}  Topic: {topic}
Question: {question_text}

Now compare with the accepted answers: {detail}

Judge two things:
1. Is at least one accepted answer actually correct?
2. Is there a common, clearly-correct way a child would phrase the answer
   (a synonym, a plural, a fuller phrase) that the accept list would mark
   WRONG? Only count phrasings a child at this level would realistically type.

End with "VERDICT: SUSPECT reason..." if the accepted answer is wrong OR a
clearly-correct child answer would be rejected. Otherwise "VERDICT: CLEAN".""",
    "match_pairs": """Solve this UK school matching exercise yourself before looking at the
recorded pairing.

Subject: {subject}  Year: {year_group}  Topic: {topic}
Question: {question_text}
Left items and right items, with the recorded pairing: {detail}

Judge two things:
1. Is every recorded pairing correct?
2. Could any left item defensibly match a DIFFERENT right item, making the
   exercise ambiguous?

End with "VERDICT: SUSPECT reason..." if a pairing is wrong or ambiguous.
Otherwise "VERDICT: CLEAN".""",
    "ordered_list": """Work out the correct order yourself before looking at the recorded order.

Subject: {subject}  Year: {year_group}  Topic: {topic}
Question: {question_text}
Recorded order (first to last): {detail}

Judge: is the recorded order correct, and is it the ONLY defensible order
given the question?

End with "VERDICT: SUSPECT reason..." if the order is wrong or another order
is equally defensible. Otherwise "VERDICT: CLEAN".""",
    "plain": """Answer this UK school question yourself, from scratch, before reading the
recorded answer.

Subject: {subject}  Year: {year_group}  Topic: {topic}
Question: {question_text}
Recorded answer: {detail}

End with "VERDICT: SUSPECT reason..." if your answer disagrees or the
recorded answer is wrong. Otherwise "VERDICT: CLEAN".""",
}

REFUTE = """You are an examiner hunting for errors in a UK school quiz bank. Try to
PROVE this item defective: a wrong fact, a rejected-but-correct child answer,
a wrong or ambiguous pairing, or a wrong or non-unique order.

Subject: {subject}  Year: {year_group}  Topic: {topic}
Type: {question_type}
Question: {question_text}
Recorded answer material: {detail}

End with "VERDICT: SUSPECT reason..." if you found a defect, otherwise
"VERDICT: CLEAN"."""


def detail_for(q: dict) -> str:
    parts = q.get("answer_parts")
    t = q["question_type"]
    if t == "short_answer_text" and parts:
        accepts = [p.get("accept", "") for p in parts if isinstance(p, dict)]
        return f"accepted answers: {accepts}"
    if t == "match_pairs" and parts:
        return "; ".join(f"'{p.get('left')}' = '{p.get('right')}'" for p in parts if isinstance(p, dict))
    if t == "ordered_list" and parts:
        return " -> ".join(str(p.get("item")) for p in parts if isinstance(p, dict))
    return str(q.get("correct_answer") or "")


def shape_of(q: dict) -> str:
    return q["question_type"] if q["question_type"] in ("short_answer_text", "match_pairs", "ordered_list") else "plain"


def one_vote(q: dict, template: str) -> tuple[bool, str]:
    prompt = template.format(
        subject=q["subject"], year_group=q["year_group"], topic=q["topic"],
        question_text=q["question_text"], question_type=q["question_type"],
        detail=detail_for(q),
    )
    last = "no attempts"
    for attempt in range(3):
        try:
            res = client.chat.completions.create(
                model=MODEL, max_tokens=700,
                messages=[{"role": "user", "content": prompt}],
            )
            text = (res.choices[0].message.content or "").strip()
            m = re.search(r"VERDICT:\s*(CLEAN|SUSPECT)(.*)", text, re.I | re.S)
            if not m:
                return True, "no verdict returned"
            if m.group(1).upper() == "CLEAN":
                return False, ""
            return True, m.group(2).strip()[:300]
        except Exception as e:  # noqa: BLE001
            last = f"{type(e).__name__}: {e}"
            time.sleep(1.5 * (attempt + 1))
    return True, f"vote errored: {last}"


def check_question(q: dict) -> dict:
    solve_s, solve_r = one_vote(q, SOLVE[shape_of(q)])
    refute_s, refute_r = one_vote(q, REFUTE)
    # Which votes make a suspect is decided by --rule, chosen from calibration:
    # 'solve' trusts only the independent solver; 'either' accepts both angles.
    is_suspect = solve_s if RULE == "solve" else (solve_s or refute_s)
    reasons = [x for x in (f"(solve) {solve_r}" if solve_s else "", f"(refute) {refute_r}" if refute_s else "") if x]
    return {
        "id": q["id"], "suspect": is_suspect, "type": q["question_type"],
        "reasons": reasons, "votes": {"solve_first": solve_s, "refute": refute_s},
        "question": q["question_text"][:160], "detail": detail_for(q)[:200],
    }


def fetch(limit: int | None, order_random: bool) -> list[dict]:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(f"""
            SELECT qq.id::text, qq.question_type, qq.question_text, qq.correct_answer,
                   qq.answer_parts, t.title AS topic, s.name AS subject, yg.label AS year_group
            FROM quiz_questions qq
            JOIN topics t ON t.id = qq.topic_id
            JOIN subjects s ON s.id = t.subject_id
            JOIN year_groups yg ON yg.id = t.year_group_id
            WHERE qq.status = 'published'
              AND (qq.distractors IS NULL OR jsonb_array_length(qq.distractors) < 2)
            ORDER BY {"random()" if order_random else "qq.id"}
            {f"LIMIT {int(limit)}" if limit else ""}
        """)
        rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def corrupt(q: dict, rng: random.Random, donors: list[dict]) -> bool:
    """Plant one shape-appropriate error. Returns True if planted."""
    t, parts = q["question_type"], q.get("answer_parts")
    if t == "short_answer_text" and parts:
        # A wrong answer borrowed from another question of the same subject:
        # plausible in register, wrong in fact.
        pool = [d for d in donors
                if d["question_type"] == t and d["id"] != q["id"] and d.get("answer_parts")]
        if not pool:
            return False
        donor = rng.choice(pool)["answer_parts"][0].get("accept", "")
        if not donor or any(donor == p.get("accept") for p in parts):
            return False
        q["answer_parts"] = [{"accept": donor}]
        return True
    if t == "match_pairs" and parts and len(parts) >= 2:
        i, j = rng.sample(range(len(parts)), 2)
        parts[i]["right"], parts[j]["right"] = parts[j]["right"], parts[i]["right"]
        return True
    if t == "ordered_list" and parts and len(parts) >= 2:
        i = rng.randrange(len(parts) - 1)
        parts[i], parts[i + 1] = parts[i + 1], parts[i]
        return True
    return False


def run_panel(questions: list[dict], concurrency: int) -> list[dict]:
    out = []
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(check_question, q) for q in questions]
        for i, f in enumerate(as_completed(futures), 1):
            out.append(f.result())
            if i % 20 == 0:
                rate = i / max(time.time() - t0, 1)
                log.info("[%d/%d] suspects=%d eta=%.0fmin", i, len(questions),
                         sum(1 for r in out if r["suspect"]), (len(questions) - i) / rate / 60)
    return out


def calibrate(n: int, concurrency: int) -> None:
    qs = fetch(n, order_random=True)
    rng = random.Random(11)
    corrupted = set()
    for q in qs[: len(qs) // 2]:
        if corrupt(q, rng, qs):
            corrupted.add(q["id"])
    log.info("calibration: %d questions, %d secretly corrupted", len(qs), len(corrupted))
    results = run_panel(qs, concurrency)
    planted = [r for r in results if r["id"] in corrupted]
    intact = [r for r in results if r["id"] not in corrupted]
    log.info("-- CALIBRATION RESULT (both rules, from the same votes) --")
    for rule, pick in (("solve-only", lambda r: r["votes"]["solve_first"]),
                       ("either",     lambda r: r["votes"]["solve_first"] or r["votes"]["refute"])):
        caught = sum(1 for r in planted if pick(r))
        noise = sum(1 for r in intact if pick(r))
        log.info("rule %-10s caught %d/%d (%.0f%%)  false alarms %d/%d (%.0f%%)",
                 rule, caught, len(planted), 100 * caught / max(len(planted), 1),
                 noise, len(intact), 100 * noise / max(len(intact), 1))
    caught = sum(1 for r in planted if r["suspect"])
    for r in [r for r in planted if not r["suspect"]][:8]:
        log.info("MISSED [%s]: %s | %s", r["type"], r["question"][:90], r["detail"][:80])
    verdict = "PASS - sweep is worth running" if caught / max(len(planted), 1) >= 0.95 else \
              "FAIL - do not trust a sweep"
    log.info("verdict: %s", verdict)


def sweep(limit: int | None, concurrency: int) -> None:
    qs = fetch(limit, order_random=False)
    log.info("sweep: %d open-answer questions on %s", len(qs), MODEL)
    results = run_panel(qs, concurrency)
    suspects = [r for r in results if r["suspect"]]
    Path(SUSPECTS_PATH).write_text(json.dumps(suspects, indent=2))
    log.info("done: %d/%d suspect -> %s (clean: %d)",
             len(suspects), len(results), SUSPECTS_PATH, len(results) - len(suspects))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--calibrate", type=int, metavar="N")
    ap.add_argument("--sweep", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--concurrency", type=int, default=2)
    ap.add_argument("--rule", choices=("solve", "either"), default="either")
    args = ap.parse_args()
    global RULE
    RULE = args.rule
    if args.calibrate:
        calibrate(args.calibrate, args.concurrency)
    elif args.sweep:
        sweep(args.limit, args.concurrency)
    else:
        ap.error("pick --calibrate N or --sweep")


if __name__ == "__main__":
    main()
