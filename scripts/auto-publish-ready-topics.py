"""
Publish any topic that has >= 5 published questions and is not yet published.
Safe to run at any time — idempotent, read-heavy, single small write per topic.

Usage:
  python3 scripts/auto-publish-ready-topics.py
  python3 scripts/auto-publish-ready-topics.py --threshold 10  # stricter
  python3 scripts/auto-publish-ready-topics.py --dry-run
"""
from __future__ import annotations
import argparse, os, subprocess, sys
import psycopg2, psycopg2.extras

# Load env
_e = subprocess.run(
    ["bash", "-c", "set -a && source /root/decifer-learning/.env.local && set +a && env"],
    capture_output=True, text=True).stdout
for line in _e.splitlines():
    if "=" in line:
        k, _, v = line.partition("="); os.environ.setdefault(k, v)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=int, default=5)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    conn = psycopg2.connect(os.environ.get("DATABASE_URL") or os.environ["DIRECT_URL"])
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT t.id, t.title, yg.label AS year, s.name AS subject,
               COUNT(qq.id) FILTER (WHERE qq.status = 'published') AS pub_q
        FROM topics t
        JOIN year_groups yg ON yg.id = t.year_group_id
        JOIN subjects   s  ON s.id  = t.subject_id
        LEFT JOIN quiz_questions qq ON qq.topic_id = t.id
        WHERE t.is_published = false
        GROUP BY t.id, t.title, yg.label, s.name
        HAVING COUNT(qq.id) FILTER (WHERE qq.status = 'published') >= %s
        ORDER BY yg.label, s.name
    """, (args.threshold,))
    rows = cur.fetchall()

    if not rows:
        print(f"Nothing to publish (threshold={args.threshold} Qs).")
        return

    print(f"{'DRY RUN — ' if args.dry_run else ''}Publishing {len(rows)} topics (>={args.threshold} Qs):\n")
    for r in rows:
        print(f"  {'[dry] ' if args.dry_run else ''}✓ {r['year']} {r['subject']}: {r['title']} ({r['pub_q']}Q)")
        if not args.dry_run:
            cur.execute("UPDATE topics SET is_published = true WHERE id = %s", (r["id"],))

    if not args.dry_run:
        conn.commit()
        print(f"\n{len(rows)} topics published.")

if __name__ == "__main__":
    main()
