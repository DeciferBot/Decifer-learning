"""
report-content-coverage.py — Current content coverage for the Decifer Learning pilot.

Shows every topic's Q count, learn_content status, publish gate state, and exact
next command needed. Grouped by year group and subject.

This is the "what's left before go-live" view. It intentionally does NOT do deep
pipeline diagnosis (see diagnose-content-blockers.py for that). It answers:
  • How many topics are fully child-ready (Q ≥ 10 AND learn_content published)?
  • How many are waiting only for learn_content generation?
  • How many have enough questions but are not yet promoted?
  • How many are still below the question threshold?
  • What exact command do I run next for each category?

Run: /root/pipeline-venv/bin/python3 scripts/report-content-coverage.py
     /root/pipeline-venv/bin/python3 scripts/report-content-coverage.py --year year-7
     /root/pipeline-venv/bin/python3 scripts/report-content-coverage.py --csv
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import sys
from pathlib import Path

# ── Environment ───────────────────────────────────────────────────────────────

_env_file = Path(__file__).parent.parent / ".env.local"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _k, _, _v = _line.partition("=")
        _k = _k.strip()
        _v = _v.strip().strip('"').strip("'")
        if _k and _v:
            os.environ[_k] = _v

if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

if not os.environ.get("DATABASE_URL"):
    sys.stderr.write("DATABASE_URL not set\n")
    sys.exit(1)

import psycopg2
import psycopg2.extras
from pgvector.psycopg2 import register_vector

# ── Constants ─────────────────────────────────────────────────────────────────

MIN_QUESTIONS    = 10
MIN_LEARN_CONTENT = 1

PYTHON = "/root/pipeline-venv/bin/python3"
SCRIPTS = "scripts"

# Status levels — priority order for the "next action" table
STATUS_FULLY_LIVE      = "fully_live"       # Q≥10 AND LC≥1 AND is_published=true
STATUS_READY_PROMOTE   = "ready_to_promote" # Q≥10 AND LC≥1 AND is_published=false
STATUS_NEEDS_LC        = "needs_lc"         # Q≥10 AND LC=0
STATUS_NEEDS_QUESTIONS = "needs_questions"  # Q<10
STATUS_EMPTY           = "empty"            # Q=0

_STATUS_DISPLAY = {
    STATUS_FULLY_LIVE:      ("🌟", "LIVE"),
    STATUS_READY_PROMOTE:   ("🔓", "PROMOTE"),
    STATUS_NEEDS_LC:        ("📄", "NEED LC"),
    STATUS_NEEDS_QUESTIONS: ("🔒", "NEED Q"),
    STATUS_EMPTY:           ("⬜", "EMPTY"),
}

# ── DB query ──────────────────────────────────────────────────────────────────

def fetch_coverage(year_filter: str | None = None) -> list[dict]:
    """Fetch all topics with their published Q/LC counts and gate state."""
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            q = """
                SELECT
                    t.id::text           AS topic_id,
                    t.title,
                    t.slug,
                    t.is_published,
                    yg.label             AS year_group,
                    yg.key_stage,
                    s.name               AS subject,
                    COUNT(qq.id)  FILTER (WHERE qq.status = 'published') AS pub_q,
                    COUNT(qq.id)  FILTER (WHERE qq.status = 'staged')    AS staged_q,
                    COUNT(lc.id)  FILTER (WHERE lc.status = 'published') AS pub_lc
                FROM topics t
                JOIN year_groups yg ON yg.id = t.year_group_id
                JOIN subjects    s  ON s.id  = t.subject_id
                LEFT JOIN quiz_questions qq ON qq.topic_id = t.id
                LEFT JOIN learn_content  lc ON lc.topic_id = t.id
            """
            conds: list[str] = []
            params: list = []
            if year_filter:
                conds.append("LOWER(yg.label) = LOWER(%s)")
                params.append(year_filter)
            if conds:
                q += " WHERE " + " AND ".join(conds)
            q += """
                GROUP BY t.id, t.title, t.slug, t.is_published,
                         yg.label, yg.key_stage, s.name
                ORDER BY yg.label, s.name, pub_q DESC, t.slug
            """
            cur.execute(q, params)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

# ── Classification ─────────────────────────────────────────────────────────────

def _classify(row: dict) -> str:
    pub_q  = row["pub_q"]
    pub_lc = row["pub_lc"]
    is_pub = row["is_published"]

    if pub_q >= MIN_QUESTIONS and pub_lc >= MIN_LEARN_CONTENT:
        if is_pub:
            return STATUS_FULLY_LIVE
        return STATUS_READY_PROMOTE
    if pub_q >= MIN_QUESTIONS and pub_lc == 0:
        return STATUS_NEEDS_LC
    if pub_q == 0:
        return STATUS_EMPTY
    return STATUS_NEEDS_QUESTIONS

# ── Formatting ────────────────────────────────────────────────────────────────

def _bar(n: int, max_n: int = MIN_QUESTIONS, width: int = 10) -> str:
    filled = min(round(n / max_n * width), width) if max_n > 0 else 0
    return "█" * filled + "░" * (width - filled)


def print_report(rows: list[dict], year_filter: str | None) -> None:
    # Annotate each row with its status
    for r in rows:
        r["_status"] = _classify(r)

    # Sort: live first, then promote, then needs_lc, then questions, then empty
    priority = {STATUS_FULLY_LIVE: 0, STATUS_READY_PROMOTE: 1,
                STATUS_NEEDS_LC: 2, STATUS_NEEDS_QUESTIONS: 3, STATUS_EMPTY: 4}
    rows.sort(key=lambda r: (r["year_group"], r["subject"], priority.get(r["_status"], 9)))

    # ── Summary stats ─────────────────────────────────────────────────────────
    from collections import Counter
    status_counts = Counter(r["_status"] for r in rows)

    total = len(rows)
    live  = status_counts[STATUS_FULLY_LIVE]
    promote = status_counts[STATUS_READY_PROMOTE]
    need_lc = status_counts[STATUS_NEEDS_LC]
    need_q  = status_counts[STATUS_NEEDS_QUESTIONS]
    empty   = status_counts[STATUS_EMPTY]

    print(f"\n{'═'*80}")
    print(f"  DECIFER LEARNING — CONTENT COVERAGE REPORT")
    if year_filter:
        print(f"  Filter: year_group = {year_filter!r}")
    print(f"  {total} topics total  |  🌟 {live} live  |  🔓 {promote} ready-to-promote  |  "
          f"📄 {need_lc} need-LC  |  🔒 {need_q} need-Q  |  ⬜ {empty} empty")
    print(f"{'═'*80}\n")

    # ── Per-year, per-subject table ───────────────────────────────────────────
    current_group = None

    for r in rows:
        group_key = (r["year_group"], r["subject"])
        if group_key != current_group:
            if current_group is not None:
                print()
            current_group = group_key
            print(f"  ── {r['year_group']} · {r['subject']}")
            print(f"  {'Title':<38} {'Q':>4} {'LC':>3} {'Bar':>12}  {'Status':<10} {'Slug'}")
            print(f"  {'─'*88}")

        sym, label = _STATUS_DISPLAY[r["_status"]]
        bar = _bar(r["pub_q"])
        q_display = f"{r['pub_q']}/{MIN_QUESTIONS}"
        pub_note = " 🔓" if r["is_published"] else ""

        print(
            f"  {r['title'][:38]:<38} {q_display:>4} {r['pub_lc']:>3} "
            f"  [{bar}]  {sym} {label:<8} {r['slug']}{pub_note}"
        )

    print()

    # ── Action commands ───────────────────────────────────────────────────────
    needs_promote = [r for r in rows if r["_status"] == STATUS_READY_PROMOTE]
    needs_lc_rows = [r for r in rows if r["_status"] == STATUS_NEEDS_LC]
    needs_q_rows  = [r for r in rows if r["_status"] in (STATUS_NEEDS_QUESTIONS, STATUS_EMPTY)]

    print(f"{'═'*80}")
    print(f"  REQUIRED NEXT ACTIONS")
    print(f"{'─'*80}\n")

    if not needs_promote and not needs_lc_rows and not needs_q_rows:
        print(f"  ✅ All topics are fully live — nothing to do!\n")
        return

    # 1. Promotions (is_published flip)
    if needs_promote:
        print(f"  ① PROMOTE {len(needs_promote)} topic(s) to is_published=true")
        print(f"     (Q ≥ {MIN_QUESTIONS} and LC ≥ 1 already present):")
        for r in needs_promote:
            print(f"     • {r['slug']} (Q={r['pub_q']} LC={r['pub_lc']})")
        print(f"\n     Run: npx ts-node scripts/publish-ready-topics.ts\n")

    # 2. Learn content generation
    if needs_lc_rows:
        print(f"  ② GENERATE learn_content for {len(needs_lc_rows)} topic(s)")
        print(f"     (Q ≥ {MIN_QUESTIONS} already; learn_content is the only missing gate):")
        for r in needs_lc_rows:
            print(f"     • {r['slug']} (Q={r['pub_q']})")
        print(f"\n     Run: {PYTHON} {SCRIPTS}/generate-learn-content.py\n")

    # 3. Question generation (grouped by likely blocker strategy)
    if needs_q_rows:
        print(f"  ③ GENERATE QUESTIONS for {len(needs_q_rows)} topic(s) below {MIN_QUESTIONS}Q:")
        for r in needs_q_rows:
            missing = MIN_QUESTIONS - r["pub_q"]
            print(f"     • {r['slug']} (Q={r['pub_q']}, needs +{missing})")

        print()

        # Categorise by likely strategy
        spelling_slugs   = [r["slug"] for r in needs_q_rows if "spelling" in r["slug"] or "prefix" in r["slug"] or "suffix" in r["slug"]]
        physics_slugs    = [r["slug"] for r in needs_q_rows if "forces" in r["slug"] or "motion" in r["slug"]]
        sci_div_slugs    = [r["slug"] for r in needs_q_rows if "plants" in r["slug"] or "animals" in r["slug"] or "cells" in r["slug"]]
        lit_slugs        = [r["slug"] for r in needs_q_rows if "literature" in r["slug"] or "character" in r["slug"]]
        topup_slugs      = [
            r["slug"] for r in needs_q_rows
            if r["slug"] not in spelling_slugs + physics_slugs + sci_div_slugs + lit_slugs
        ]

        printed_any = False

        if spelling_slugs:
            printed_any = True
            print(f"     Strategy: spelling (force english_spelling type):")
            print(f"     {PYTHON} {SCRIPTS}/recover-weak-topics.py \\")
            print(f"       --strategy spelling \\")
            print(f"       --slugs {' '.join(spelling_slugs)}")
            print()

        if physics_slugs:
            printed_any = True
            print(f"     Strategy: physics (require verification_expression):")
            print(f"     {PYTHON} {SCRIPTS}/recover-weak-topics.py \\")
            print(f"       --strategy physics \\")
            print(f"       --slugs {' '.join(physics_slugs)}")
            print()

        if sci_div_slugs:
            printed_any = True
            print(f"     Strategy: science_diversity (pre-reject answer repeats):")
            print(f"     {PYTHON} {SCRIPTS}/recover-weak-topics.py \\")
            print(f"       --strategy science_diversity \\")
            print(f"       --slugs {' '.join(sci_div_slugs)}")
            print()

        if lit_slugs:
            printed_any = True
            print(f"     Strategy: literature (+5 quality buffer active):")
            print(f"     {PYTHON} {SCRIPTS}/recover-weak-topics.py \\")
            print(f"       --strategy literature \\")
            print(f"       --slugs {' '.join(lit_slugs)}")
            print()

        if topup_slugs:
            printed_any = True
            print(f"     Strategy: topup (general — for topics with no dominant blocker):")
            print(f"     {PYTHON} {SCRIPTS}/recover-weak-topics.py \\")
            print(f"       --strategy topup \\")
            print(f"       --slugs {' '.join(topup_slugs)}")
            print()

        if not printed_any:
            print(f"     Run diagnose for details:")
            print(f"     {PYTHON} {SCRIPTS}/diagnose-content-blockers.py")
            print()

    # 4. Deep diagnosis for any stuck topics
    stuck = [r for r in needs_q_rows if r["pub_q"] > 0 and r["pub_q"] < MIN_QUESTIONS]
    if stuck:
        stuck_slugs = " ".join(r["slug"] for r in stuck[:5])
        print(f"  ④ RUN DIAGNOSIS for stuck topics (Q > 0 but below gate):")
        print(f"     {PYTHON} {SCRIPTS}/diagnose-content-blockers.py")
        print(f"     # or for specific slugs:")
        print(f"     {PYTHON} {SCRIPTS}/diagnose-content-blockers.py --slug {stuck_slugs.split()[0]}")
        print()

    print(f"{'═'*80}\n")


def print_csv(rows: list[dict]) -> None:
    for r in rows:
        r["_status"] = _classify(r)

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=[
        "year_group", "subject", "slug", "title",
        "pub_q", "staged_q", "pub_lc", "is_published", "status"
    ])
    writer.writeheader()
    for r in rows:
        writer.writerow({
            "year_group":  r["year_group"],
            "subject":     r["subject"],
            "slug":        r["slug"],
            "title":       r["title"],
            "pub_q":       r["pub_q"],
            "staged_q":    r["staged_q"],
            "pub_lc":      r["pub_lc"],
            "is_published": r["is_published"],
            "status":      r["_status"],
        })
    print(buf.getvalue())


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Content coverage report for Decifer Learning.")
    parser.add_argument("--year", help="Filter to one year group, e.g. year-7")
    parser.add_argument("--csv",  action="store_true", help="Output CSV instead of table")
    args = parser.parse_args()

    rows = fetch_coverage(year_filter=args.year)
    if not rows:
        print("No topics found (check --year filter or database connection).")
        sys.exit(1)

    if args.csv:
        print_csv(rows)
    else:
        print_report(rows, year_filter=args.year)


if __name__ == "__main__":
    main()
