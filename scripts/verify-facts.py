"""
Run the evidence verifier over closed-world factual questions and record the verdict.

Nothing is unpublished automatically. A "refuted" verdict is written to
question_metadata for review; taking content down stays a human decision, because
a search-based checker can be wrong and a retire is terminal.

Usage:
  # Cost probe first — always. Prints actual spend for the sample.
  python3 scripts/verify-facts.py --limit 10 --dry-run

  # Record verdicts for a batch
  python3 scripts/verify-facts.py --limit 200

  # One specific question, printed in full
  python3 scripts/verify-facts.py --question-id <uuid> --dry-run -v
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

_REPO = "/root/decifer-learning"

_e = subprocess.run(
    ["bash", "-c", f"set -a && source {_REPO}/.env.local && set +a && env"],
    capture_output=True, text=True,
).stdout
for line in _e.splitlines():
    if "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k, v)

sys.path.insert(0, f"{_REPO}/services/content-pipeline")
import config  # noqa: E402
from verifiers import evidence  # noqa: E402

import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402

# The pass-through types: Stage 2 returns True for these without checking anything.
FACTUAL_TYPES = (
    "history_factual", "geography_factual", "biology_factual", "science_factual",
    "chemistry_element_fact",
)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--question-id")
    ap.add_argument("--subject")
    ap.add_argument("--dry-run", action="store_true", help="do not write verdicts back")
    ap.add_argument("--model", default=evidence.DEFAULT_MODEL)
    ap.add_argument("--effort", default="medium", choices=["low", "medium", "high"])
    ap.add_argument("--max-searches", type=int, default=4)
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--recheck", action="store_true", help="include already-checked rows")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    conn = psycopg2.connect(config.DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    where = ["qq.status = 'published'", "qq.question_type = ANY(%s)"]
    params: list = [list(FACTUAL_TYPES)]
    if args.question_id:
        where = ["qq.id = %s"]
        params = [args.question_id]
    else:
        if args.subject:
            where.append("s.name = %s")
            params.append(args.subject)
        if not args.recheck:
            where.append("qq.question_metadata->'evidence_check' IS NULL")

    params.append(args.limit)
    cur.execute(
        f"""
        SELECT qq.id, qq.question_text, qq.correct_answer, qq.distractors, qq.question_type,
               t.title, s.name AS subject_name, yg.label AS year_group_label
        FROM quiz_questions qq
        JOIN topics t       ON t.id  = qq.topic_id
        JOIN subjects s     ON s.id  = t.subject_id
        JOIN year_groups yg ON yg.id = t.year_group_id
        WHERE {' AND '.join(where)}
        ORDER BY md5(qq.id::text)
        LIMIT %s
        """,
        params,
    )
    rows = cur.fetchall()
    if not rows:
        print("Nothing to check.")
        return 0

    print(f"Checking {len(rows)} questions with {args.model} "
          f"(evidence v{evidence.EVIDENCE_VERIFIER_VERSION}, concurrency {args.concurrency})\n")

    def check(row):
        distractors = row["distractors"]
        if isinstance(distractors, str):
            try:
                distractors = json.loads(distractors)
            except Exception:
                distractors = []
        result = evidence.verify(
            {
                "question_text": row["question_text"],
                "correct_answer": row["correct_answer"],
                "distractors": distractors,
            },
            {
                "subject_name": row["subject_name"],
                "year_group_label": row["year_group_label"],
                "title": row["title"],
            },
            model=args.model,
            effort=args.effort,
            max_searches=args.max_searches,
        )
        return row, result

    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        outcomes = list(pool.map(check, rows))

    verdicts: Counter = Counter()
    for row, result in outcomes:
        verdicts[result["verdict"]] += 1
        marker = {"confirmed": "ok  ", "refuted": "WRONG", "uncertain": "?   "}[result["verdict"]]
        print(f"{marker} [{row['year_group_label']} {row['subject_name']}] "
              f"{(row['question_text'] or '')[:88]}")
        if result["verdict"] != "confirmed" or args.verbose:
            print(f"       keyed: {row['correct_answer']}")
            if result["notes"]:
                print(f"       note:  {result['notes'][:220]}")
            for d in result["also_correct_distractors"]:
                print(f"       ALSO CORRECT: {d.get('distractor')} — "
                      f"{str(d.get('why_also_correct'))[:150]}")
            if args.verbose and result["answer_evidence"]:
                print(f"       quote: {result['answer_evidence'][:200]}")
                print(f"       src:   {result['answer_source_url'][:120]}")

    print("\nVerdicts:", dict(verdicts))
    spend = evidence.estimate_cost([r for _, r in outcomes])
    print(f"Spend: ${spend['usd']} for {spend['questions']} questions "
          f"(${spend['usd_per_question']}/question, {spend['searches']} searches)")

    remaining = None
    if not args.question_id:
        cur.execute(
            """
            SELECT COUNT(*) AS n FROM quiz_questions
            WHERE status='published' AND question_type = ANY(%s)
              AND question_metadata->'evidence_check' IS NULL
            """,
            (list(FACTUAL_TYPES),),
        )
        remaining = cur.fetchone()["n"]
        print(f"Unchecked factual questions remaining: {remaining} "
              f"(~${round(remaining * spend['usd_per_question'], 2)} to finish)")

    if args.dry_run:
        print("\nDry run — no verdicts written.")
        return 0

    for row, result in outcomes:
        cur.execute(
            """
            UPDATE quiz_questions
               SET question_metadata = COALESCE(question_metadata, '{}'::jsonb)
                   || jsonb_build_object('evidence_check', %s::jsonb)
             WHERE id = %s
            """,
            (json.dumps({
                "verdict": result["verdict"],
                "evidence": result["answer_evidence"][:1000],
                "source_url": result["answer_source_url"][:500],
                "also_correct_distractors": result["also_correct_distractors"],
                "notes": result["notes"][:500],
                "model": result["model"],
                "verifier_version": result["verifier_version"],
            }), row["id"]),
        )
    conn.commit()
    print(f"\nRecorded {len(outcomes)} verdicts. Nothing unpublished — "
          f"review 'refuted' rows before acting.")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
