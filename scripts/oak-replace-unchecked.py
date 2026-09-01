#!/usr/bin/env python3
"""
Retire old never-checked questions wherever teacher-written cover is deep enough.

THE TRADE. About 3,200 published questions predate every checking system: no
calculator verified their answer, no grammar tool read them, and the measured
defect rate for that batch is roughly one in ten. Checking them costs money and
still cannot promise zero. Removing them costs nothing and is right by
construction — PROVIDED the child still has plenty to play. So: where the same
topic and difficulty now holds at least MIN_OAK teacher-written Oak questions
(defect rate ~1 in 100), the old unchecked ones are retired. Everywhere else
they stay, and the paid sweep judges them one by one (scripts/verify-facts.py).

`retired` is the terminal state (CLAUDE.md §8) — nothing drains it back in
front of children, unlike `flagged`/`staged`, which are work queues. That
distinction silently undid the July audit once already.

Every retired row's id and prior status go to a restore file first, so one
command can put everything back.

Usage:
  python3 scripts/oak-replace-unchecked.py            # dry run — the plan
  python3 scripts/oak-replace-unchecked.py --apply
  python3 scripts/oak-replace-unchecked.py --restore FILE   # undo a run
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
for _envfile in (REPO / ".env.local", Path("/root/decifer-learning/.env.local")):
    if _envfile.exists():
        _e = subprocess.run(["bash", "-c", f"set -a && source {_envfile} && set +a && env"],
                            capture_output=True, text=True).stdout
        for line in _e.splitlines():
            if "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k, v)
        break

import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402

# How many teacher-written questions a topic+tier must hold before we are
# willing to take the old unchecked ones out of it. Quiz rounds are 5 questions,
# so 8 leaves a full round plus variety.
MIN_OAK = 8

# Answer-checked by code (calculator, unit checker, element table) — never
# touched here, whatever their age.
CODE_CHECKED = ("maths_arithmetic", "maths_algebra", "maths_geometry",
                "science_physics_calculation", "science_chemistry_equation",
                "chemistry_element_fact")


def dsn() -> str:
    raw = (os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL") or "").strip().strip('"')
    if not raw:
        sys.exit("no DIRECT_URL or DATABASE_URL")
    return raw.split("?")[0]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--restore", metavar="FILE", help="undo: republish the ids in FILE")
    args = ap.parse_args()

    conn = psycopg2.connect(dsn())
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if args.restore:
        ids = [r["id"] for r in json.loads(Path(args.restore).read_text())["rows"]]
        cur.execute("UPDATE quiz_questions SET status='published' WHERE id = ANY(%s::uuid[]) AND status='retired'", (ids,))
        conn.commit()
        print(f"Restored {cur.rowcount} of {len(ids)} questions to published.")
        return 0

    cur.execute("""
        WITH pool AS (
          SELECT id, topic_id, tier, question_type, question_text, generator_version,
            CASE WHEN generator_version IN ('oak-import-v1','oak-publish-v2') THEN 'oak'
                 WHEN question_type IN %s THEN 'checked'
                 WHEN question_type = 'english_grammar' THEN 'grammar'
                 ELSE 'unchecked' END AS bucket
          FROM quiz_questions WHERE status = 'published'),
        cover AS (
          SELECT topic_id, tier, COUNT(*) FILTER (WHERE bucket = 'oak') AS oak
          FROM pool GROUP BY 1, 2)
        SELECT p.id, p.tier, p.question_type, LEFT(p.question_text, 70) AS q, t.slug
        FROM pool p
        JOIN cover c ON c.topic_id = p.topic_id AND c.tier = p.tier
        JOIN topics t ON t.id = p.topic_id
        WHERE p.bucket = 'unchecked' AND c.oak >= %s
        ORDER BY t.slug, p.tier
    """, (CODE_CHECKED, MIN_OAK))
    rows = [dict(r) for r in cur.fetchall()]

    print(f"{len(rows)} old never-checked questions sit where Oak cover is >= {MIN_OAK}.")
    from collections import Counter
    for (slug, tier), n in sorted(Counter((r["slug"], r["tier"]) for r in rows).items())[:12]:
        print(f"  {n:>4}  {slug} [{tier}]")
    if len(rows) == 0:
        return 0

    if not args.apply:
        print("\nDRY RUN — nothing retired. Add --apply.")
        return 0

    stamp = time.strftime("%Y%m%d-%H%M%S")
    out = Path(f"/tmp/retired-replaced-by-oak-{stamp}.json")
    out.write_text(json.dumps({"reason": "replaced-by-oak-cover", "min_oak": MIN_OAK,
                               "rows": rows}, indent=1, default=str))
    cur.execute("""
        UPDATE quiz_questions
           SET status = 'retired',
               question_metadata = COALESCE(question_metadata, '{}'::jsonb)
                 || jsonb_build_object('retired_reason', 'replaced-by-oak-cover',
                                       'retired_at', %s)
         WHERE id = ANY(%s::uuid[]) AND status = 'published'
    """, (stamp, [r["id"] for r in rows]))
    conn.commit()
    print(f"\nRetired {cur.rowcount}. Restore file: {out}")
    print(f"Undo with: python3 scripts/oak-replace-unchecked.py --restore {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
