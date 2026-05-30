"""
report-content-coverage.py — Content coverage for Decifer Learning.

Two modes:
  Default : shows every DB topic's Q count, learn_content status and next action.
  --gaps  : diffs the DB against docs/UK_NATIONAL_CURRICULUM_MAP.md — shows topics
            in the north-star map that are not yet seeded, and DB topics not in the map.

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
     /root/pipeline-venv/bin/python3 scripts/report-content-coverage.py --gaps
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


# ── Gap analysis against UK_NATIONAL_CURRICULUM_MAP.md ───────────────────────

import re

# Year-group label variants that appear in the map headings → canonical DB label
_YG_ALIASES: dict[str, str] = {
    "year 1": "year-1", "year 2": "year-2", "year 3": "year-3",
    "year 4": "year-4", "year 5": "year-5", "year 6": "year-6",
    "year 7": "year-7", "year 8": "year-8", "year 9": "year-9",
    "year 7–9 (ks3)": "year-7",   # KS3 block maps to year-7 for seeding purposes
    "year 1–2 (ks1)": "year-1",
    "year 3–6 (ks2)": "year-3",
}

def _parse_curriculum_map() -> list[dict]:
    """
    Parse docs/UK_NATIONAL_CURRICULUM_MAP.md and return a list of
    { subject, year_group, title } dicts — one per topic row in the map.
    """
    map_path = Path(__file__).parent.parent / "docs" / "UK_NATIONAL_CURRICULUM_MAP.md"
    if not map_path.exists():
        sys.stderr.write(f"Cannot find {map_path}\n")
        sys.exit(1)

    lines = map_path.read_text().splitlines()

    topics: list[dict] = []
    current_subject: str | None = None
    current_yg: str | None = None

    # State machine: look for H1 subject headers, H2 year-group headers, table rows
    for line in lines:
        stripped = line.strip()

        # H1 = subject name (e.g. "# MATHEMATICS")
        if stripped.startswith("# ") and not stripped.startswith("## "):
            raw = stripped.lstrip("# ").strip()
            # Skip the document title and section markers
            if raw.upper() in ("UK NATIONAL CURRICULUM MAP — DECIFER LEARNING",
                               "MATHEMATICS", "ENGLISH", "SCIENCE", "HISTORY",
                               "GEOGRAPHY", "COMPUTING", "DESIGN AND TECHNOLOGY",
                               "ART AND DESIGN", "MUSIC", "PHYSICAL EDUCATION",
                               "LANGUAGES (MFL)", "CITIZENSHIP"):
                current_subject = raw.title().replace("(Mfl)", "(MFL)")
                # Normalise subject names to match the subjects table
                _SUBJECT_NORM = {
                    "Mathematics": "Maths",
                    "Physical Education": "Physical Education",
                    "Design And Technology": "Design and Technology",
                    "Art And Design": "Art and Design",
                    "Languages (Mfl)": "Languages",
                }
                current_subject = _SUBJECT_NORM.get(current_subject, current_subject)
                current_yg = None
            continue

        # H2 = year group (e.g. "## Year 3", "## Year 7–9 (KS3)")
        if stripped.startswith("## "):
            raw_yg = stripped.lstrip("# ").strip().lower()
            current_yg = _YG_ALIASES.get(raw_yg)
            continue

        # H3 = sub-section (e.g. "### Year 7–9 (KS3) — Biology")
        if stripped.startswith("### "):
            raw_yg = stripped.lstrip("# ").split("—")[0].strip().lower()
            current_yg = _YG_ALIASES.get(raw_yg, current_yg)
            continue

        # Table row: "| 1 | Topic title |" — skip headers and separators
        if stripped.startswith("|") and current_subject and current_yg:
            parts = [p.strip() for p in stripped.strip("|").split("|")]
            # Rows have 2 cols (# | Title) or 3 cols (# | Title | Strand)
            if len(parts) >= 2:
                num_col = parts[0].strip()
                title_col = parts[1].strip()
                # Skip header rows and separator rows
                if (title_col.lower() in ("#", "topic", "---", "")
                        or re.match(r"^-+$", num_col)
                        or re.match(r"^-+$", title_col)):
                    continue
                # Skip rows where the number column isn't a digit (it's a header)
                if not re.match(r"^\d+$", num_col):
                    continue
                topics.append({
                    "subject":    current_subject,
                    "year_group": current_yg,
                    "title":      title_col,
                })

    return topics


def print_gaps(db_rows: list[dict]) -> None:
    """Compare the curriculum map against DB topics and report gaps in both directions."""
    map_topics = _parse_curriculum_map()

    # Build sets for comparison: (subject, year_group, normalised_title)
    def _norm(s: str) -> str:
        return re.sub(r"\s+", " ", s.strip().lower())

    db_set: set[tuple] = {
        (_norm(r["subject"]), _norm(r["year_group"]), _norm(r["title"]))
        for r in db_rows
    }
    map_set: set[tuple] = {
        (_norm(t["subject"]), _norm(t["year_group"]), _norm(t["title"]))
        for t in map_topics
    }

    missing_from_db = [
        t for t in map_topics
        if (_norm(t["subject"]), _norm(t["year_group"]), _norm(t["title"])) not in db_set
    ]
    orphans_in_db = [
        r for r in db_rows
        if (_norm(r["subject"]), _norm(r["year_group"]), _norm(r["title"])) not in map_set
    ]

    print(f"\n{'═'*80}")
    print(f"  CURRICULUM GAP ANALYSIS")
    print(f"  North star: docs/UK_NATIONAL_CURRICULUM_MAP.md  ({len(map_topics)} topics)")
    print(f"  Database:   {len(db_rows)} topics seeded")
    print(f"  Missing from DB: {len(missing_from_db)}  |  In DB but not in map: {len(orphans_in_db)}")
    print(f"{'═'*80}\n")

    if missing_from_db:
        print(f"  ── MISSING FROM DATABASE ({len(missing_from_db)} topics)")
        print(f"     These are in the curriculum map but have not been seeded yet.\n")
        # Group by subject + year_group
        from collections import defaultdict
        grouped: dict = defaultdict(list)
        for t in missing_from_db:
            grouped[(t["subject"], t["year_group"])].append(t["title"])
        for (subject, yg), titles in sorted(grouped.items()):
            print(f"     {yg} · {subject} ({len(titles)} topics):")
            for title in titles:
                print(f"       • {title}")
        print()

    if orphans_in_db:
        print(f"  ── IN DATABASE BUT NOT IN MAP ({len(orphans_in_db)} topics)")
        print(f"     These may be old topic names, typos, or topics added outside the map.\n")
        for r in sorted(orphans_in_db, key=lambda x: (x["year_group"], x["subject"])):
            print(f"     {r['year_group']} · {r['subject']}: \"{r['title']}\"")
        print()

    if not missing_from_db and not orphans_in_db:
        print(f"  ✅ Database is fully aligned with the curriculum map — no gaps!\n")

    print(f"{'═'*80}\n")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Content coverage report for Decifer Learning.")
    parser.add_argument("--year", help="Filter to one year group, e.g. year-7")
    parser.add_argument("--csv",  action="store_true", help="Output CSV instead of table")
    parser.add_argument("--gaps", action="store_true",
                        help="Diff DB topics against docs/UK_NATIONAL_CURRICULUM_MAP.md")
    args = parser.parse_args()

    rows = fetch_coverage(year_filter=args.year)
    if not rows and not args.gaps:
        print("No topics found (check --year filter or database connection).")
        sys.exit(1)

    if args.gaps:
        print_gaps(rows)
    elif args.csv:
        print_csv(rows)
    else:
        print_report(rows, year_filter=args.year)


if __name__ == "__main__":
    main()
