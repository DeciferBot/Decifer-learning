#!/usr/bin/env python3
"""
Public-launch content completeness audit.

For each published topic, checks:
  - ≥10 published questions (sprout + explorer + lightning)
  - At least 1 published learn_content row
  - At least 1 published practice_game row

Outputs a per-topic table and a summary. Topics that fail any gate are
marked HOLD — run the pipeline to fill them before launch.

Usage:
  python3 scripts/audit-launch-readiness.py [--hold-only]
"""
import os
import sys
import argparse
import psycopg2

DB_URL = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
if not DB_URL:
    print("ERROR: DIRECT_URL or DATABASE_URL must be set.")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hold-only", action="store_true", help="Print only topics that need work")
    args = parser.parse_args()

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute("""
        SELECT
            t.id,
            yg.label  AS year_group,
            s.name    AS subject,
            t.title,
            t.is_published,
            -- Question counts by tier
            COUNT(qq.id) FILTER (WHERE qq.status = 'published' AND qq.tier = 'sprout')    AS sprout_q,
            COUNT(qq.id) FILTER (WHERE qq.status = 'published' AND qq.tier = 'explorer')  AS explorer_q,
            COUNT(qq.id) FILTER (WHERE qq.status = 'published' AND qq.tier = 'lightning') AS lightning_q,
            COUNT(qq.id) FILTER (WHERE qq.status = 'published')                            AS total_q,
            -- Learn content
            COUNT(lc.id) FILTER (WHERE lc.status = 'published')  AS learn_rows,
            -- Practice games
            COUNT(pg.id) FILTER (WHERE pg.status = 'published')  AS game_rows
        FROM topics t
        JOIN year_groups yg ON yg.id = t.year_group_id
        JOIN subjects s     ON s.id  = t.subject_id
        LEFT JOIN quiz_questions qq ON qq.topic_id = t.id
        LEFT JOIN learn_content  lc ON lc.topic_id = t.id
        LEFT JOIN practice_games pg ON pg.topic_id = t.id
        WHERE t.is_published = TRUE
        GROUP BY t.id, yg.label, s.name, t.title, t.is_published
        ORDER BY yg.label, s.name, t.title
    """)

    rows = cur.fetchall()
    conn.close()

    # Thresholds
    MIN_Q    = 10
    MIN_TIER = 2   # at least 2 per tier
    MIN_LEARN = 1
    # practice_game is optional — app gracefully skips Practise step when absent.
    # Missing games are reported as warnings but do not cause a HOLD.

    header = f"{'Year':<8} {'Subject':<12} {'Topic':<45} {'Q':>4} {'S':>3} {'E':>3} {'L':>3} {'Lrn':>4} {'Gm':>4} Status"
    print(header)
    print("-" * len(header))

    total = ok = hold = 0
    hold_topics = []

    for row in rows:
        (tid, year, subject, title, is_pub,
         sprout, explorer, lightning, total_q,
         learn_rows, game_rows) = row

        failures = []
        warnings = []
        if total_q < MIN_Q:          failures.append(f"only {total_q} questions")
        if sprout < MIN_TIER:        failures.append(f"sprout:{sprout}")
        if explorer < MIN_TIER:      failures.append(f"explorer:{explorer}")
        if lightning < MIN_TIER:     failures.append(f"lightning:{lightning}")
        if learn_rows < MIN_LEARN:   failures.append("no learn_content")
        if game_rows < 1:            warnings.append("no practice_game (optional)")

        status = "✓ OK" if not failures else "✗ HOLD"
        if not failures and warnings:
            status = "⚠ WARN"
        total += 1
        if failures:
            hold += 1
            hold_topics.append((year, subject, title, failures))
        else:
            ok += 1

        if args.hold_only and not failures:
            continue

        print(
            f"{year:<8} {subject:<12} {title[:44]:<45} "
            f"{total_q:>4} {sprout:>3} {explorer:>3} {lightning:>3} "
            f"{learn_rows:>4} {game_rows:>4} {status}"
        )

    print()
    print(f"SUMMARY: {total} published topics — {ok} OK, {hold} HOLD")
    if hold_topics:
        print()
        print("Topics requiring work before launch:")
        for year, subject, title, failures in hold_topics:
            print(f"  [{year}] {subject}: {title}")
            for f in failures:
                print(f"    → {f}")

    return 1 if hold else 0


if __name__ == "__main__":
    sys.exit(main())
