"""
diagnose-content-blockers.py — Closed-loop recovery diagnostic for Decifer Learning.

Inspects every weak topic (< 10 published questions OR missing learn_content) and
classifies the dominant blocker from the pipeline run history. Produces a sorted
action table so recovery runs are targeted, not blind.

Blocker codes:
  insufficient_questions    — fewer than 10 published, no dominant failure pattern
  wrong_question_type       — LLM generated high-threshold type (vocabulary/factual)
                              for a topic that should use a lower-threshold type
  dedup_loop                — majority of failures are near-duplicate rejections
  missing_required_field    — verification_expression absent for physics calculations
  verifier_score_margin     — score consistently at 70–84 (constitutional violations
                              dragging below 85) or 80–89 (dragging below 90)
  rag_grounding_failure     — source_chunk_ids empty or missing
  language_tool_false_positive — verified=False caused by LT on prose fields
  constitutional_violation  — 1+ constitutional violations per attempt on average
  learn_content_missing     — ≥ 10 Q published but no learn_content row
  ready_for_lc              — ≥ 10 Q published, LC missing, no pipeline blocker
  ready_for_publish_gate    — ≥ 10 Q AND ≥ 1 LC, is_published=False
  currently_running         — a pipeline lock exists for this topic's year group
  unknown                   — not enough data to classify

Run: /root/pipeline-venv/bin/python3 scripts/diagnose-content-blockers.py [--all] [--year YEAR]

--all   : include topics that already have 10+ Q and LC (for full audit)
--year  : filter to one year group key, e.g. year-3 or year-7
--slug  : inspect one specific topic slug
--json  : output machine-readable JSON instead of ASCII table

Exit codes:
  0 — diagnosis complete (even if blockers found)
  1 — internal error (DB connection, missing env vars)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from collections import Counter
from pathlib import Path

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("diagnose")

# ── Environment ───────────────────────────────────────────────────────────────

_env_file = Path(__file__).parent.parent / ".env.local"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and val:
            os.environ[key] = val

if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

if not os.environ.get("DATABASE_URL"):
    sys.stderr.write("DATABASE_URL not set\n")
    sys.exit(1)

pipeline_dir = Path(__file__).parent.parent / "services" / "content-pipeline"
sys.path.insert(0, str(pipeline_dir))

import psycopg2
import psycopg2.extras
from pgvector.psycopg2 import register_vector

# ── Constants ─────────────────────────────────────────────────────────────────

MIN_QUESTIONS = 10

# Map slug substrings → expected question type
SLUG_TYPE_EXPECTATIONS: dict[str, str] = {
    "spelling":    "english_spelling",
    "grammar":     "english_grammar",
    "apostrophe":  "english_grammar",
    "conjunction": "english_grammar",
    "verb-tense":  "english_grammar",
    "punctuation": "english_grammar",
    "sentence-type": "english_grammar",
    "standard-english": "english_grammar",
    "comprehension": "english_comprehension",
    "reading":     "english_comprehension",
    "vocabulary":  "english_vocabulary",
    "word-famil":  "english_vocabulary",
    "literature":  "english_literary_analysis",
    "character":   "english_literary_analysis",
    "plants":      "biology_factual",
    "animals":     "biology_factual",
    "cells":       "biology_factual",
    "ecosystems":  "biology_factual",
    "reproduction": "biology_factual",
    "forces":      "science_physics_calculation",
    "energy":      "science_factual",
    "space":       "science_factual",
    "elements":    "science_factual",
    "particles":   "science_factual",
    "rocks":       "science_factual",
    "light":       "science_factual",
    "magnets":     "science_factual",
}

# Low-threshold types (≤ 85): wrong if a high-threshold type was generated instead
LOW_THRESHOLD_TYPES = {
    "english_grammar", "english_spelling",
    "maths_arithmetic", "maths_algebra", "maths_geometry",
    "science_physics_calculation", "science_chemistry_equation", "chemistry_element_fact",
}
HIGH_THRESHOLD_TYPES = {
    "english_comprehension", "english_vocabulary", "english_literary_analysis",
    "biology_factual", "science_factual",
}

# Score patterns suggesting specific blockers
SCORE_DEDUP_PENALTY = 20.0       # dedup removes 20 points
SCORE_CONSTITUTIONAL_PENALTY = 10.0  # each violation removes 10 points

# Lock dir to check for running processes
LOCK_DIR = Path("/tmp/decifer-pipeline-locks")

# ── DB connection ─────────────────────────────────────────────────────────────

def _conn():
    c = psycopg2.connect(os.environ["DATABASE_URL"])
    register_vector(c)
    return c

# ── Data fetchers ─────────────────────────────────────────────────────────────

def fetch_topics(year_filter: str | None = None, slug_filter: str | None = None) -> list[dict]:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            q = """
                SELECT
                    t.id, t.title, t.slug, t.is_published,
                    yg.label AS year_group_label, yg.key_stage,
                    s.name AS subject_name,
                    COUNT(qq.id) FILTER (WHERE qq.status='published') AS pub_q,
                    COUNT(qq.id) FILTER (WHERE qq.status='staged')    AS staged_q,
                    COUNT(qq.id) FILTER (WHERE qq.status='regenerating') AS regen_q,
                    COUNT(lc.id) FILTER (WHERE lc.status='published') AS pub_lc
                FROM topics t
                JOIN year_groups yg ON yg.id = t.year_group_id
                JOIN subjects s ON s.id = t.subject_id
                LEFT JOIN quiz_questions qq ON qq.topic_id = t.id
                LEFT JOIN learn_content lc ON lc.topic_id = t.id
            """
            conds = []
            params: list = []
            if year_filter:
                conds.append("LOWER(yg.label) = LOWER(%s)")
                params.append(year_filter)
            if slug_filter:
                conds.append("t.slug = %s")
                params.append(slug_filter)
            if conds:
                q += " WHERE " + " AND ".join(conds)
            q += " GROUP BY t.id, t.title, t.slug, t.is_published, yg.label, yg.key_stage, s.name"
            q += " ORDER BY pub_q ASC, t.slug"
            cur.execute(q, params)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def fetch_generation_errors(topic_id: str, limit: int = 40) -> list[dict]:
    """Fetch the most recent generation errors for a topic."""
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT stage_failed, error_message, raw_llm_output, created_at
                FROM generation_errors
                WHERE topic_id = %s
                ORDER BY created_at DESC
                LIMIT %s
            """, (topic_id, limit))
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def fetch_recent_scores(topic_id: str, limit: int = 30) -> list[float]:
    """Fetch confidence scores for recent non-published questions (staged/regenerating)."""
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT confidence_score
                FROM quiz_questions
                WHERE topic_id = %s AND status != 'published'
                ORDER BY created_at DESC
                LIMIT %s
            """, (topic_id, limit))
            return [r[0] for r in cur.fetchall() if r[0] is not None]
    finally:
        conn.close()


def fetch_published_question_types(topic_id: str) -> list[str]:
    """Return question_type values for all published questions in a topic."""
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT question_type FROM quiz_questions
                WHERE topic_id = %s AND status = 'published'
            """, (topic_id,))
            return [r[0] for r in cur.fetchall() if r[0]]
    finally:
        conn.close()


def fetch_recent_question_types_staged(topic_id: str, limit: int = 20) -> list[str]:
    """Return question_types for recent non-published questions."""
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT question_type FROM quiz_questions
                WHERE topic_id = %s AND status != 'published'
                ORDER BY created_at DESC
                LIMIT %s
            """, (topic_id, limit))
            return [r[0] for r in cur.fetchall() if r[0]]
    finally:
        conn.close()


def fetch_last_pipeline_run(topic_id: str) -> dict | None:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT run_type, status, items_attempted, items_published,
                       items_failed, error_log, started_at
                FROM pipeline_runs
                WHERE topic_id = %s
                ORDER BY started_at DESC LIMIT 1
            """, (topic_id,))
            r = cur.fetchone()
            return dict(r) if r else None
    finally:
        conn.close()

# ── Lock check ────────────────────────────────────────────────────────────────

def _running_locks() -> set[str]:
    """Return the set of currently held lock names."""
    if not LOCK_DIR.exists():
        return set()
    return {p.stem for p in LOCK_DIR.iterdir() if p.suffix == ".lock"}


def _year_lock_name(year_label: str) -> str:
    """Map year group label to lock key."""
    return f"batch-{year_label}"

# ── Diagnosis logic ───────────────────────────────────────────────────────────

def _expected_type_for_slug(slug: str) -> str | None:
    """Return the expected low-threshold type if the slug implies one, else None."""
    if not slug:
        return None
    lower = slug.lower()
    for key, qtype in SLUG_TYPE_EXPECTATIONS.items():
        if key in lower:
            return qtype
    return None


def _classify_error_messages(errors: list[dict]) -> dict[str, int]:
    """Count failure categories in generation_errors rows."""
    counts: dict[str, int] = Counter()
    for e in errors:
        msg = (e.get("error_message") or "").lower()
        raw = e.get("raw_llm_output") or {}
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raw = {}

        # Dedup
        if "duplicate" in msg or "similarity" in msg:
            counts["dedup"] += 1
        # Missing field
        elif "verification_expression" in msg or "missing required" in msg:
            counts["missing_field"] += 1
        # LT false positive on prose fields
        elif "grammar error in" in msg and "explanation" in msg:
            counts["lt_prose"] += 1
        elif "grammar error in" in msg and (
            "hint" in msg or "correct_answer" in msg
        ):
            counts["lt_prose"] += 1
        # LT span check (intentional error)
        elif "grammar error in" in msg and "stimulus" in msg:
            counts["lt_stimulus"] += 1
        # Wrong type (RAG-required generated where code-verified expected)
        elif raw.get("question_type") in HIGH_THRESHOLD_TYPES:
            counts["wrong_type"] += 1
        # Constitutional violation (from raw output or score)
        elif e.get("stage_failed") == 6:
            score = None
            if isinstance(raw, dict):
                score = raw.get("score")
            msg_score = re.search(r"score=([\d.]+)", msg)
            if msg_score:
                s = float(msg_score.group(1))
                # Dedup penalty is exactly 20; score at 70 for physics = 90-20
                if s in (70.0, 80.0) or (abs(s - 70.0) < 1 or abs(s - 80.0) < 1):
                    counts["dedup"] += 1
                elif s < 90.0:
                    counts["constitutional"] += 1
            else:
                counts["constitutional"] += 1
        else:
            counts["other"] += 1
    return dict(counts)


def diagnose_topic(topic: dict, verbose: bool = False) -> dict:
    """Classify the dominant blocker for a single topic."""
    slug = topic.get("slug") or ""
    pub_q = topic["pub_q"]
    pub_lc = topic["pub_lc"]
    subject = topic.get("subject_name", "").lower()
    year = topic.get("year_group_label", "")
    tid = str(topic["id"])

    result = {
        "year": year,
        "subject": topic.get("subject_name", ""),
        "slug": slug,
        "title": topic.get("title", ""),
        "pub_q": pub_q,
        "required": MIN_QUESTIONS,
        "missing_q": max(0, MIN_QUESTIONS - pub_q),
        "pub_lc": pub_lc,
        "is_published": topic.get("is_published", False),
        "staged_q": topic.get("staged_q", 0),
        "regen_q": topic.get("regen_q", 0),
        "dominant_blocker": "unknown",
        "action": "inspect_manually",
        "risk": "medium",
        "notes": [],
    }

    running_locks = _running_locks()
    year_lock = _year_lock_name(year)
    topup_running = "topup" in running_locks
    batch_running = year_lock in running_locks

    # ── Already fully ready ───────────────────────────────────────────────
    if pub_q >= MIN_QUESTIONS and pub_lc >= 1 and topic.get("is_published"):
        result["dominant_blocker"] = "ready_for_publish_gate"
        result["action"] = "no_action"
        result["risk"] = "none"
        return result

    if pub_q >= MIN_QUESTIONS and pub_lc >= 1 and not topic.get("is_published"):
        result["dominant_blocker"] = "ready_for_publish_gate"
        result["action"] = "run_promote_ready_topics"
        result["risk"] = "none"
        return result

    if pub_q >= MIN_QUESTIONS and pub_lc == 0:
        result["dominant_blocker"] = "ready_for_lc"
        result["action"] = "run_generate_learn_content"
        result["risk"] = "low"
        return result

    # ── Topic has questions but is below gate ─────────────────────────────
    errors = fetch_generation_errors(tid, limit=50)
    staged_types = fetch_recent_question_types_staged(tid, limit=30)
    recent_scores = fetch_recent_scores(tid, limit=30)

    error_counts = _classify_error_messages(errors)

    # Check for currently running job
    if topup_running or batch_running:
        result["dominant_blocker"] = "currently_running"
        lock_name = "topup" if topup_running else year_lock
        result["action"] = f"wait_for_lock_{lock_name}"
        result["risk"] = "low"
        result["notes"].append(f"Lock '{lock_name}' is held")
        return result

    # Determine expected type for this topic
    expected_type = _expected_type_for_slug(slug)

    # Compute dominant error
    total_errors = sum(error_counts.values()) or 1
    dedup_rate = error_counts.get("dedup", 0) / total_errors
    lt_rate = (error_counts.get("lt_prose", 0) + error_counts.get("lt_stimulus", 0)) / total_errors
    missing_field_rate = error_counts.get("missing_field", 0) / total_errors
    wrong_type_count = error_counts.get("wrong_type", 0)
    constitutional_rate = error_counts.get("constitutional", 0) / total_errors

    # Wrong type: staged questions are high-threshold types but topic should be low-threshold
    type_mismatch = False
    if expected_type in LOW_THRESHOLD_TYPES and staged_types:
        wrong_type_count_staged = sum(1 for t in staged_types if t in HIGH_THRESHOLD_TYPES)
        if wrong_type_count_staged / len(staged_types) >= 0.5:
            type_mismatch = True
            result["notes"].append(
                f"staged type mismatch: {Counter(staged_types).most_common(2)} "
                f"(expected {expected_type})"
            )

    # Physics: check for missing verification_expression
    physics_topic = "science_physics_calculation" in str(expected_type) or "force" in slug
    if physics_topic:
        # Look at generation_errors raw_llm_output for missing verification_expression
        missing_ve = sum(
            1 for e in errors
            if "verification_expression" in (e.get("error_message") or "").lower()
            or (
                isinstance(e.get("raw_llm_output"), dict)
                and not e["raw_llm_output"].get("verification_expression")
                and e["raw_llm_output"].get("question_type") == "science_physics_calculation"
            )
        )
        if missing_ve > 0:
            result["dominant_blocker"] = "missing_required_field"
            result["action"] = "recover_physics_with_strict_prompt"
            result["risk"] = "low"
            result["notes"].append(
                f"verification_expression absent in {missing_ve}/{len(errors)} errors"
            )
            return result

    # Classify dominant blocker
    if dedup_rate >= 0.50 and len(errors) >= 5:
        result["dominant_blocker"] = "dedup_loop"
        result["action"] = "recover_science_with_diversity"
        result["risk"] = "low"
        result["notes"].append(
            f"dedup in {error_counts.get('dedup',0)}/{len(errors)} recent attempts"
        )
        # Add forbidden-concept guidance
        pub_types = fetch_published_question_types(tid)
        result["notes"].append(
            f"published type breakdown: {dict(Counter(pub_types))}"
        )

    elif type_mismatch:
        result["dominant_blocker"] = "wrong_question_type"
        result["action"] = "recover_spelling_with_forced_type"
        result["risk"] = "low"

    elif missing_field_rate >= 0.30:
        result["dominant_blocker"] = "missing_required_field"
        result["action"] = "recover_physics_with_strict_prompt"
        result["risk"] = "low"

    elif lt_rate >= 0.30:
        result["dominant_blocker"] = "language_tool_false_positive"
        result["action"] = "retry_with_normalizer"
        result["risk"] = "low"
        result["notes"].append(
            f"LT prose/stimulus errors in {int(lt_rate*100)}% of attempts"
        )

    elif constitutional_rate >= 0.30:
        result["dominant_blocker"] = "verifier_score_margin"
        result["action"] = "retry_with_buffer_active"
        result["risk"] = "medium"
        result["notes"].append(
            f"constitutional violations in {int(constitutional_rate*100)}% of attempts"
        )

    elif recent_scores:
        avg_score = sum(recent_scores) / len(recent_scores)
        if avg_score < 50:
            result["dominant_blocker"] = "rag_grounding_failure"
            result["action"] = "check_curriculum_chunks"
            result["risk"] = "high"
            result["notes"].append(f"avg staged score={avg_score:.0f} (very low)")
        else:
            result["dominant_blocker"] = "insufficient_questions"
            result["action"] = "run_topup"
            result["risk"] = "low"

    elif pub_q == 0 and len(errors) == 0:
        result["dominant_blocker"] = "insufficient_questions"
        result["action"] = "run_topup"
        result["risk"] = "low"
        result["notes"].append("no attempts yet — topic not yet generated")

    else:
        result["dominant_blocker"] = "insufficient_questions"
        result["action"] = "run_topup"
        result["risk"] = "low"

    return result

# ── Formatting ────────────────────────────────────────────────────────────────

_BLOCKER_SYMBOL = {
    "insufficient_questions":        "📊",
    "wrong_question_type":           "🔤",
    "dedup_loop":                    "🔁",
    "missing_required_field":        "⚙️ ",
    "verifier_score_margin":         "🔸",
    "rag_grounding_failure":         "📚",
    "language_tool_false_positive":  "💬",
    "constitutional_violation":      "⚠️ ",
    "learn_content_missing":         "📄",
    "ready_for_lc":                  "✅",
    "ready_for_publish_gate":        "🌟",
    "currently_running":             "⏳",
    "unknown":                       "❓",
}

_ACTION_SUMMARY = {
    "no_action":                       "No action needed",
    "run_promote_ready_topics":        "Run: publish-ready-topics.ts",
    "run_generate_learn_content":      "Run: generate-learn-content.py",
    "run_topup":                       "Run: recover-weak-topics.py --strategy=topup",
    "recover_spelling_with_forced_type": "Run: recover-weak-topics.py --strategy=spelling",
    "recover_science_with_diversity":  "Run: recover-weak-topics.py --strategy=science_diversity",
    "recover_physics_with_strict_prompt": "Run: recover-weak-topics.py --strategy=physics",
    "retry_with_normalizer":           "Run: recover-weak-topics.py --strategy=topup",
    "retry_with_buffer_active":        "Run: recover-weak-topics.py --strategy=topup",
    "check_curriculum_chunks":         "Manual: check curriculum_chunks table",
    "inspect_manually":                "Manual inspection required",
    "wait_for_lock_topup":             "Wait: topup process is running",
    "wait_for_lock_batch-year-3":      "Wait: year-3 batch is running",
    "wait_for_lock_batch-year-7":      "Wait: year-7 batch is running",
}


def print_table(rows: list[dict], show_all: bool) -> None:
    visible = [r for r in rows if show_all or r["dominant_blocker"] not in (
        "ready_for_publish_gate", "no_action"
    )]
    if not visible:
        print("\n  ✅ All topics are fully ready — no blockers found.\n")
        return

    # Group by action priority
    priority = {
        "currently_running": 0,
        "ready_for_publish_gate": 1,
        "ready_for_lc": 2,
        "missing_required_field": 3,
        "dedup_loop": 4,
        "wrong_question_type": 5,
        "verifier_score_margin": 6,
        "language_tool_false_positive": 7,
        "rag_grounding_failure": 8,
        "insufficient_questions": 9,
        "unknown": 10,
    }
    visible.sort(key=lambda r: (priority.get(r["dominant_blocker"], 10), r["year"], r["slug"]))

    col_w = {
        "year":   7, "subject": 9, "slug": 44, "q": 4, "lc": 3,
        "blocker": 30, "action": 44, "risk": 6,
    }
    header = (
        f"  {'Year':<{col_w['year']}}  {'Subject':<{col_w['subject']}}  "
        f"{'Slug':<{col_w['slug']}}  {'Q':>{col_w['q']}}  {'LC':>{col_w['lc']}}  "
        f"{'Blocker':<{col_w['blocker']}}  {'Action':<{col_w['action']}}  {'Risk':<{col_w['risk']}}"
    )
    print("\n" + "═" * len(header.rstrip()))
    print("  DECIFER LEARNING — CONTENT BLOCKER DIAGNOSIS")
    print("═" * len(header.rstrip()))
    print(header)
    print("  " + "─" * (len(header.rstrip()) - 2))

    prev_blocker = None
    for r in visible:
        if r["dominant_blocker"] != prev_blocker:
            print()
            prev_blocker = r["dominant_blocker"]

        sym = _BLOCKER_SYMBOL.get(r["dominant_blocker"], "?")
        blocker_str = f"{sym} {r['dominant_blocker']}"
        action_str = _ACTION_SUMMARY.get(r["action"], r["action"])
        slug_display = (r["slug"] or r["title"] or "")[:col_w["slug"]]

        print(
            f"  {r['year']:<{col_w['year']}}  {r['subject']:<{col_w['subject']}}  "
            f"{slug_display:<{col_w['slug']}}  {r['pub_q']:>{col_w['q']}}  {r['pub_lc']:>{col_w['lc']}}  "
            f"{blocker_str:<{col_w['blocker']}}  {action_str:<{col_w['action']}}  {r['risk']:<{col_w['risk']}}"
        )
        if r.get("notes"):
            for note in r["notes"]:
                print(f"  {'':>{col_w['year']}}  {'':>{col_w['subject']}}  "
                      f"    ↳ {note}")

    print()

    # Summary stats
    blocker_counts = Counter(r["dominant_blocker"] for r in visible)
    ready_lc = blocker_counts.get("ready_for_lc", 0)
    ready_pub = blocker_counts.get("ready_for_publish_gate", 0)
    stuck = sum(v for k, v in blocker_counts.items()
                if k not in ("ready_for_lc", "ready_for_publish_gate",
                             "no_action", "currently_running"))
    running = blocker_counts.get("currently_running", 0)

    print("═" * len(header.rstrip()))
    print(f"  SUMMARY:  {ready_lc} ready for LC  |  {ready_pub} ready to publish  |  "
          f"{stuck} blocked  |  {running} currently running")
    print("═" * len(header.rstrip()))
    print()

    # Per-strategy command recommendations
    strategies = {
        "spelling": [r["slug"] for r in visible if r["action"] == "recover_spelling_with_forced_type"],
        "science_diversity": [r["slug"] for r in visible if r["action"] == "recover_science_with_diversity"],
        "physics": [r["slug"] for r in visible if r["action"] == "recover_physics_with_strict_prompt"],
        "topup": [r["slug"] for r in visible if r["action"] in (
            "run_topup", "retry_with_normalizer", "retry_with_buffer_active"
        )],
        "lc": [r["slug"] for r in visible if r["action"] == "run_generate_learn_content"],
    }

    has_rec = any(v for v in strategies.values())
    if has_rec:
        print("  RECOMMENDED NEXT COMMANDS")
        print("  " + "─" * 60)
        if strategies["lc"]:
            print(f"  # Generate learn_content for {len(strategies['lc'])} ready topics:")
            print(f"    /root/pipeline-venv/bin/python3 scripts/generate-learn-content.py")
        if strategies["spelling"]:
            slugs = " ".join(strategies["spelling"])
            print(f"  # Spelling recovery ({len(strategies['spelling'])} topics):")
            print(f"    /root/pipeline-venv/bin/python3 scripts/recover-weak-topics.py "
                  f"--strategy spelling --slugs {slugs}")
        if strategies["science_diversity"]:
            slugs = " ".join(strategies["science_diversity"])
            print(f"  # Science diversity recovery ({len(strategies['science_diversity'])} topics):")
            print(f"    /root/pipeline-venv/bin/python3 scripts/recover-weak-topics.py "
                  f"--strategy science_diversity --slugs {slugs}")
        if strategies["physics"]:
            slugs = " ".join(strategies["physics"])
            print(f"  # Physics recovery ({len(strategies['physics'])} topics):")
            print(f"    /root/pipeline-venv/bin/python3 scripts/recover-weak-topics.py "
                  f"--strategy physics --slugs {slugs}")
        if strategies["topup"]:
            slugs = " ".join(strategies["topup"])
            print(f"  # General topup ({len(strategies['topup'])} topics):")
            print(f"    /root/pipeline-venv/bin/python3 scripts/recover-weak-topics.py "
                  f"--strategy topup --slugs {slugs}")
        print()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Diagnose content pipeline blockers.")
    parser.add_argument("--all", action="store_true", help="Include fully ready topics")
    parser.add_argument("--year", help="Filter to one year group, e.g. year-7")
    parser.add_argument("--slug", help="Diagnose one specific topic slug")
    parser.add_argument("--json", action="store_true", dest="as_json",
                        help="Output machine-readable JSON")
    args = parser.parse_args()

    print(f"\n  Loading topics from DB...", end="", flush=True)
    topics = fetch_topics(year_filter=args.year, slug_filter=args.slug)
    print(f" {len(topics)} found.\n")

    diagnoses = []
    for topic in topics:
        d = diagnose_topic(topic)
        diagnoses.append(d)

    if args.as_json:
        print(json.dumps(diagnoses, indent=2, default=str))
        return

    # Filter to blockers unless --all
    if not args.all:
        filtered = [
            d for d in diagnoses
            if d["dominant_blocker"] not in ("no_action",) or args.all
        ]
    else:
        filtered = diagnoses

    print_table(filtered, show_all=args.all)


if __name__ == "__main__":
    main()
