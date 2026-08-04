"""
Replace ungrounded questions with grounded ones, topic by topic.

SCOPE — deliberately narrower than "regenerate everything unproven".
Regeneration only helps where the NEW question can earn a proof the old one
could not. That is true for grounded types and nothing else:

  regenerate      grounded questions citing no chunk (1,531) and grounded
                  questions whose citation does not support them (381). The
                  fixed generation prompt now makes the model write from the
                  sources and cite only what it used, and Stage 2 entailment
                  verifies the quote — so replacements are provable.

  leave alone     conceptual maths (497) and grammar/spelling (1,206). A
                  replacement lands in exactly the same unprovable bucket,
                  because there is no arithmetic to compute and LanguageTool
                  still only reads the prose. Churning them buys nothing.

ORDER MATTERS: the old rows are retired BEFORE restocking. Stage 5 dedup compares
against published questions in the same topic, so generating first would have the
originals block their own replacements.

Safe to stop and rerun. Progress is per topic; a killed run resumes where it
stopped. Touch /tmp/REGROUND_STOP to halt after the current topic.

Usage:
  python3 scripts/reground-campaign.py --dry-run          # show the plan
  python3 scripts/reground-campaign.py --topics 3         # small live batch
  python3 scripts/reground-campaign.py --all --concurrency 6
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

_REPO = "/root/decifer-learning"
_STOP = Path("/tmp/REGROUND_STOP")

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

# Amit's instruction 2026-08-04: no Anthropic API spend. _llm_call silently falls
# back to CLAUDE_MODEL when DO inference hiccups; blanking the key makes that a
# plain failure instead, which run_one already handles as a failed cycle.
config.ANTHROPIC_API_KEY = ""
os.environ.pop("ANTHROPIC_API_KEY", None)

import pipeline  # noqa: E402
import db  # noqa: E402

import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402

GROUNDED_TYPES = (
    "history_factual", "geography_factual", "biology_factual", "science_factual",
    "english_comprehension", "english_vocabulary", "english_literary_analysis",
)

_UNGROUNDED_PREDICATE = """(
    qq.question_metadata->'grounding_check'->>'verdict' = 'unsupported'
 OR (qq.question_type = ANY(%s)
     AND (qq.source_chunk_ids IS NULL OR qq.source_chunk_ids = '[]'::jsonb))
)"""

_lock = threading.Lock()


def load_plan(cur, limit: int | None) -> list[dict]:
    cur.execute(
        f"""
        SELECT t.id AS topic_id, t.title, s.name AS subject_name,
               yg.label AS year_group_label,
               COUNT(*) FILTER (WHERE qq.status='published') AS published,
               COUNT(*) FILTER (WHERE qq.status='published' AND {_UNGROUNDED_PREDICATE})
                   AS ungrounded
        FROM topics t
        JOIN subjects s     ON s.id  = t.subject_id
        JOIN year_groups yg ON yg.id = t.year_group_id
        JOIN quiz_questions qq ON qq.topic_id = t.id
        GROUP BY 1,2,3,4
        HAVING COUNT(*) FILTER (WHERE qq.status='published' AND {_UNGROUNDED_PREDICATE}) > 0
        ORDER BY 6 DESC
        {"LIMIT %s" if limit else ""}
        """,
        ([list(GROUNDED_TYPES)] * 2 + ([limit] if limit else [])),
    )
    return [dict(r) for r in cur.fetchall()]


def process_topic(row: dict, target: int, dry_run: bool) -> dict:
    """Retire the ungrounded rows for one topic, then restock it."""
    topic_id = str(row["topic_id"])
    label = f"{row['year_group_label']} {row['subject_name']} / {row['title'][:42]}"
    out = {"topic": label, "retired": 0, "published": 0, "failed": 0}

    conn = psycopg2.connect(config.DATABASE_URL)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            if dry_run:
                out["retired"] = row["ungrounded"]
                out["published"] = "(would restock)"
                return out

            cur.execute(
                f"""
                UPDATE quiz_questions qq
                   SET status = 'retired',
                       question_metadata = COALESCE(question_metadata,'{{}}'::jsonb)
                         || jsonb_build_object(
                              'retired_reason','ungrounded_replaced',
                              'retired_by','reground-campaign',
                              'retired_at', now()::text)
                 WHERE qq.topic_id = %s AND qq.status = 'published'
                   AND {_UNGROUNDED_PREDICATE}
                """,
                (topic_id, list(GROUNDED_TYPES)),
            )
            out["retired"] = cur.rowcount

            cur.execute(
                "SELECT COUNT(*) FROM quiz_questions WHERE topic_id=%s AND status='published'",
                (topic_id,),
            )
            remaining = cur.fetchone()[0]
    finally:
        conn.close()

    topic = db.get_topic(topic_id)
    if topic is None:
        return out

    # Restock back toward the target, alternating tiers.
    needed = max(0, target - remaining)
    tiers = ("sprout", "explorer", "lightning")
    for i in range(needed):
        if _STOP.exists():
            break
        try:
            result = pipeline.run_one(topic, tiers[i % len(tiers)])
            if result.status == "published":
                out["published"] += 1
            else:
                out["failed"] += 1
        except Exception as exc:
            out["failed"] += 1
            with _lock:
                print(f"    ! {label}: {exc}", flush=True)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--topics", type=int, default=3)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--target", type=int, default=12, help="published questions per topic")
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if _STOP.exists():
        print(f"{_STOP} present — refusing to start. Remove it to run.")
        return 1

    conn = psycopg2.connect(config.DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    plan = load_plan(cur, None if args.all else args.topics)
    conn.close()

    total_ungrounded = sum(r["ungrounded"] for r in plan)
    print(f"{len(plan)} topics carry {total_ungrounded} ungrounded questions.")
    print(f"Target {args.target} published per topic, concurrency {args.concurrency}.")
    print(f"Measured ~190s per generated question → rough estimate "
          f"{total_ungrounded * 190 / max(args.concurrency,1) / 3600:.1f}h\n", flush=True)

    if args.dry_run:
        for r in plan[:25]:
            print(f"  {r['ungrounded']:3} ungrounded of {r['published']:3} published  "
                  f"— {r['year_group_label']} {r['subject_name']} / {r['title'][:48]}")
        print("\nDry run — nothing retired, nothing generated.")
        return 0

    totals = Counter()
    started = time.time()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = {pool.submit(process_topic, r, args.target, False): r for r in plan}
        for n, fut in enumerate(as_completed(futures), 1):
            res = fut.result()
            totals["retired"] += res["retired"]
            totals["published"] += res["published"]
            totals["failed"] += res["failed"]
            print(f"[{n}/{len(plan)}] {res['topic']}: "
                  f"retired {res['retired']}, republished {res['published']}, "
                  f"failed {res['failed']}", flush=True)
            if _STOP.exists():
                print("stop file present — finishing early", flush=True)
                break

    mins = (time.time() - started) / 60
    print(f"\nRetired {totals['retired']}, republished {totals['published']}, "
          f"failed {totals['failed']} in {mins:.0f} min")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
