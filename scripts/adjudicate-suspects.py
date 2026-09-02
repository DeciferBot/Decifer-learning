#!/usr/bin/env python3
"""
adjudicate-suspects.py — Opus judges the strong-signal suspects, and only the
confirmed-wrong ones leave circulation.

Where this sits in the chain
----------------------------
fact-check-tiered.py sweeps the whole bank on the cheap DeepSeek route and
produces /tmp/fact-suspects.json. Cheap flags are allowed to be wrong; they
only cost a second look. This script IS the second look, for the strongest
class only: suspects where the independent solver reached a DIFFERENT answer
(votes.solve_first true). That class contained the provably wrong ones.

Opus works each question in full and returns one verdict:

  WRONG_ANSWER  — the recorded answer is factually/mathematically wrong,
                  or a listed "wrong" option is equally correct
  DEFENSIBLE    — the recorded answer stands; the cheap flag was noise
  UNSURE        — genuinely ambiguous; leave for a human

With --apply, WRONG_ANSWER rows are set to status='retired' — the terminal
state from CLAUDE.md §8, the only one nothing republishes. That enforces the
Phase 12 rule: zero verified-wrong answers in front of children. Retirement
is reversible by flipping the status back; every verdict and reason is kept
in /tmp/fact-verdicts.json, and the ids of retired rows in
/tmp/fact-retired-ids.json.

Cost: ~$0.16/question on claude-opus-5 → ~$60 for ~380. Approved by Amit
2026-09-02 with the price named first, per the bulk-LLM standing rule.
"""
from __future__ import annotations

import argparse
import json
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
if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

import anthropic
import psycopg2
import psycopg2.extras

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s",
                    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger("adjudicate")

MODEL = "claude-opus-5"
SUSPECTS = "/tmp/fact-suspects.json"
VERDICTS = "/tmp/fact-verdicts.json"
RETIRED = "/tmp/fact-retired-ids.json"

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

PROMPT = """You are the final referee for a UK school quiz bank. A cheaper
checker solved this question independently and got a different answer than
the recorded one, so it is suspected wrong. Your judgement decides whether
the question is removed from children's view.

Subject: {subject}   Year: {year_group}   Topic: {topic}
Question: {question_text}
Recorded answer: {correct_answer}
Wrong options offered: {distractors}
Cheap checker's complaint: {complaint}

Work the question fully and carefully. Then give exactly one verdict line:

VERDICT: WRONG_ANSWER <reason>   — the recorded answer is factually or
                                    mathematically incorrect, OR one of the
                                    "wrong" options is equally correct
VERDICT: DEFENSIBLE <reason>     — the recorded answer is right and clearly
                                    the single best option; the complaint
                                    does not hold up
VERDICT: UNSURE <reason>         — genuine ambiguity a human should settle

Be strict about WRONG_ANSWER: children lose this question permanently."""


def load_strong() -> list[dict]:
    suspects = json.load(open(SUSPECTS))
    return [r for r in suspects if r.get("votes", {}).get("solve_first")]


def fetch_full(ids: list[str]) -> dict[str, dict]:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT qq.id::text, qq.question_text, qq.correct_answer, qq.distractors,
                   t.title AS topic, s.name AS subject, yg.label AS year_group
            FROM quiz_questions qq
            JOIN topics t ON t.id = qq.topic_id
            JOIN subjects s ON s.id = t.subject_id
            JOIN year_groups yg ON yg.id = t.year_group_id
            WHERE qq.id::text = ANY(%s) AND qq.status = 'published'
        """, (ids,))
        rows = {r["id"]: dict(r) for r in cur.fetchall()}
    conn.close()
    return rows


def judge(q: dict, complaint: str) -> dict:
    prompt = PROMPT.format(complaint=complaint[:400], **{
        k: q[k] for k in
        ("subject", "year_group", "topic", "question_text", "correct_answer", "distractors")
    })
    for attempt in range(3):
        try:
            msg = client.messages.create(
                model=MODEL, max_tokens=3000,
                messages=[{"role": "user", "content": prompt}],
            )
            # Opus 5 may return a thinking block before the text block;
            # take every text block, not blindly the first block.
            text = " ".join(
                b.text for b in msg.content if getattr(b, "type", "") == "text"
            ).strip()
            m = re.search(r"VERDICT:\s*(WRONG_ANSWER|DEFENSIBLE|UNSURE)(.*)", text, re.I | re.S)
            verdict = m.group(1).upper() if m else "UNSURE"
            reason = (m.group(2).strip()[:400] if m else "no verdict line")
            return {"id": q["id"], "verdict": verdict, "reason": reason,
                    "question": q["question_text"][:160], "answer": str(q["correct_answer"])[:120]}
        except Exception as e:  # noqa: BLE001
            last = f"{type(e).__name__}: {e}"
            time.sleep(2 * (attempt + 1))
    return {"id": q["id"], "verdict": "UNSURE", "reason": f"judge errored: {last}",
            "question": q["question_text"][:160], "answer": str(q["correct_answer"])[:120]}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="retire WRONG_ANSWER rows (terminal status per CLAUDE.md §8)")
    ap.add_argument("--concurrency", type=int, default=2)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    strong = load_strong()
    if args.limit:
        strong = strong[: args.limit]
    full = fetch_full([r["id"] for r in strong])
    log.info("judging %d strong-signal suspects on %s (%d still published)",
             len(strong), MODEL, len(full))

    results = []
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = [
            pool.submit(judge, full[r["id"]], "; ".join(r.get("reasons", [])))
            for r in strong if r["id"] in full
        ]
        for i, f in enumerate(as_completed(futures), 1):
            results.append(f.result())
            if i % 20 == 0:
                rate = i / max(time.time() - t0, 1)
                wrong = sum(1 for r in results if r["verdict"] == "WRONG_ANSWER")
                log.info("[%d/%d] wrong=%d eta=%.0fmin", i, len(futures), wrong,
                         (len(futures) - i) / rate / 60)

    Path(VERDICTS).write_text(json.dumps(results, indent=2))
    wrong = [r for r in results if r["verdict"] == "WRONG_ANSWER"]
    unsure = [r for r in results if r["verdict"] == "UNSURE"]
    log.info("verdicts: wrong=%d defensible=%d unsure=%d -> %s",
             len(wrong), len(results) - len(wrong) - len(unsure), len(unsure), VERDICTS)

    if args.apply and wrong:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE quiz_questions SET status='retired' WHERE id::text = ANY(%s) AND status='published'",
                ([r["id"] for r in wrong],),
            )
            n = cur.rowcount
        conn.commit()
        conn.close()
        Path(RETIRED).write_text(json.dumps([r["id"] for r in wrong], indent=2))
        log.info("retired %d confirmed-wrong questions (ids in %s)", n, RETIRED)
    elif wrong:
        log.info("dry run: %d would be retired; run with --apply", len(wrong))


if __name__ == "__main__":
    main()
