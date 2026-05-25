"""
recover-weak-topics.py — Targeted closed-loop recovery for topics below the publish gate.

Strategies
----------
  spelling         — Topics generating english_vocabulary instead of english_spelling.
                     Pre-rejects wrong question types before expensive Stage 2–4
                     verification (saves ~2 LLM calls per bad question).

  science_diversity — Topics stuck in dedup loop (same concept generated repeatedly).
                     Pre-rejects answers that closely match existing published answers
                     using string similarity, before full pipeline.

  physics          — Topics where verification_expression is absent or invalid.
                     Pre-rejects physics questions missing or containing non-arithmetic
                     expressions before Stage 2–4.

  literature       — English literary analysis topics below 10Q.
                     No extra pre-reject (relies on +5 quality buffer in pipeline.py).

  topup            — General purpose. No pre-reject. For topics that just need more
                     attempts (insufficient_questions with no dominant pattern).

Token-waste protection
----------------------
If the SAME blocker type appears WASTE_THRESHOLD (5) times for a topic+tier, the
recovery script stops attempting that topic+tier and marks it as
'needs_prompt_strategy_change'. This prevents burning tokens on repeated identical
failures that indicate a prompt-level issue requiring manual intervention.

Safety constraints
------------------
- Does NOT auto-publish topics to children (is_published flip is never touched here).
- Does NOT weaken quality bars — pre-reject catches wrong types BEFORE verification,
  not instead of it. Stage 2–6 thresholds are unchanged.
- Singleton lock: only one recover process can run at a time.
- No commit or push is done by this script.

Run
---
  /root/pipeline-venv/bin/python3 scripts/recover-weak-topics.py \\
    --strategy spelling \\
    --slugs y3-english-spelling-prefixes-suffixes

  /root/pipeline-venv/bin/python3 scripts/recover-weak-topics.py \\
    --strategy science_diversity \\
    --slugs y3-science-plants-parts-functions

  /root/pipeline-venv/bin/python3 scripts/recover-weak-topics.py \\
    --strategy physics \\
    --slugs y7-science-forces-motion

  /root/pipeline-venv/bin/python3 scripts/recover-weak-topics.py \\
    --strategy topup \\
    --slugs y7-science-space-solar-system y7-english-vocabulary-word-families

  # Auto-select from DB (targets all topics matching the strategy's blocker profile):
  /root/pipeline-venv/bin/python3 scripts/recover-weak-topics.py --strategy spelling

  # Dry run — shows plan without generating anything:
  /root/pipeline-venv/bin/python3 scripts/recover-weak-topics.py \\
    --strategy physics --dry-run
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from collections import Counter
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("recover")

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
    log.info("Loaded env from .env.local")

if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

if not os.environ.get("ANTHROPIC_API_KEY"):
    log.error("ANTHROPIC_API_KEY not set")
    sys.exit(1)
if not os.environ.get("DATABASE_URL"):
    log.error("DATABASE_URL not set")
    sys.exit(1)

pipeline_dir = Path(__file__).parent.parent / "services" / "content-pipeline"
sys.path.insert(0, str(pipeline_dir))

import config
import db
import pipeline as pl
from pipeline_lock import pipeline_lock, PipelineLockError

# ── Constants ─────────────────────────────────────────────────────────────────

MIN_TARGET = 10          # questions required to pass publish gate
TIERS = ["sprout", "explorer", "lightning"]
MAX_PER_TIER = 20        # maximum generation attempts per tier per topic
BUFFER = 5               # extra attempts above the computed needed count
WASTE_THRESHOLD = 5      # same-blocker failures before stopping a topic+tier

VALID_STRATEGIES = ("spelling", "science_diversity", "physics", "literature", "topup")

# Question types that are "wrong" for each strategy
_WRONG_TYPES_FOR_STRATEGY = {
    "spelling": {
        "english_vocabulary", "english_comprehension",
        "english_literary_analysis", "biology_factual", "science_factual",
    },
    "literature": set(),   # no pre-reject; relies on +5 buffer
    "science_diversity": set(),  # pre-reject by answer similarity, not type
    "physics": set(),
    "topup": set(),
}

# ── DB helpers ────────────────────────────────────────────────────────────────

def get_topic_by_slug(slug: str) -> dict | None:
    import psycopg2
    import psycopg2.extras
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT t.id, t.title, t.slug,
                       yg.label AS year_group_label, yg.key_stage,
                       s.name AS subject_name
                FROM topics t
                JOIN year_groups yg ON yg.id = t.year_group_id
                JOIN subjects s ON s.id = t.subject_id
                WHERE t.slug = %s
            """, (slug,))
            row = cur.fetchone()
    finally:
        conn.close()
    return dict(row) if row else None


def count_published(topic_id: str) -> int:
    import psycopg2
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM quiz_questions WHERE topic_id=%s AND status='published'",
                (topic_id,)
            )
            return cur.fetchone()[0]
    finally:
        conn.close()


def get_published_answers(topic_id: str) -> list[str]:
    """Return correct_answer strings for all published questions in a topic."""
    import psycopg2
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT correct_answer FROM quiz_questions WHERE topic_id=%s AND status='published'",
                (topic_id,)
            )
            return [r[0] for r in cur.fetchall() if r[0]]
    finally:
        conn.close()


def get_weak_topics_for_strategy(strategy: str) -> list[str]:
    """Auto-select topic slugs appropriate for the given strategy from DB."""
    import psycopg2
    import psycopg2.extras
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT t.slug,
                       COUNT(qq.id) FILTER (WHERE qq.status='published') AS pub_q
                FROM topics t
                LEFT JOIN quiz_questions qq ON qq.topic_id = t.id
                GROUP BY t.slug
                HAVING COUNT(qq.id) FILTER (WHERE qq.status='published') < %s
                ORDER BY pub_q ASC, t.slug
            """, (MIN_TARGET,))
            all_weak = [(r["slug"], r["pub_q"]) for r in cur.fetchall()]
    finally:
        conn.close()

    # Filter by strategy to the likely matching topics
    strategy_slug_hints = {
        "spelling":         ["spelling", "prefix", "suffix"],
        "science_diversity": ["plants", "forces", "energy", "elements", "particles", "space"],
        "physics":          ["forces", "motion", "energy"],
        "literature":       ["literature", "character", "theme"],
        "topup":            [],  # all weak topics
    }
    hints = strategy_slug_hints.get(strategy, [])
    if not hints:
        return [slug for slug, _ in all_weak]
    return [
        slug for slug, _ in all_weak
        if any(h in slug for h in hints)
    ]


def mark_needs_strategy_change(topic_id: str, slug: str, blocker: str) -> None:
    """Log a generation_error record marking the topic as needing prompt strategy change."""
    try:
        db.write_generation_error(
            pipeline_run_id=None,
            topic_id=topic_id,
            question_type=None,
            tier="all",
            stage_failed=0,
            error_message=(
                f"WASTE_PROTECTION: topic marked needs_prompt_strategy_change. "
                f"Dominant blocker: {blocker!r} repeated {WASTE_THRESHOLD}+ times. "
                f"slug={slug!r}"
            ),
        )
    except Exception as exc:
        log.warning(f"Could not write waste-protection marker: {exc}")

# ── Pre-reject logic ──────────────────────────────────────────────────────────

def _is_arithmetic_expression(expr: str) -> bool:
    """Return True if expr contains only numbers, operators, whitespace, parens, dots."""
    return bool(re.match(r'^[\d\s.\+\-\*/\(\)\*\*]+$', str(expr).strip()))


def _answer_similarity(a: str, b: str) -> float:
    """Return SequenceMatcher ratio for two strings (case-insensitive)."""
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _pre_reject_check(
    strategy: str,
    qtype: str,
    question_data: dict,
    existing_answers: list[str],
) -> tuple[bool, str]:
    """
    Apply strategy-specific pre-reject checks after Stage 1, before Stage 2.

    Returns (rejected: bool, reason: str).
    rejected=True means skip stages 2–4 (saves ~2 LLM calls per bad question).
    All quality gates (Stage 2 LanguageTool, Stage 3 consensus, Stage 4 constitutional)
    remain intact for questions that pass this pre-check.
    """

    if strategy == "spelling":
        # The topic expects english_spelling. Reject any high-threshold RAG type.
        # english_grammar is acceptable (some spelling topics use grammar prompts).
        wrong_types = _WRONG_TYPES_FOR_STRATEGY["spelling"]
        if qtype in wrong_types:
            return True, f"wrong_question_type:{qtype}"

    elif strategy == "physics":
        if qtype == "science_physics_calculation":
            ve = question_data.get("verification_expression")
            if not ve:
                return True, "missing_verification_expression"
            if not _is_arithmetic_expression(ve):
                return True, f"non_arithmetic_expression:{str(ve)[:60]!r}"

    elif strategy == "science_diversity":
        # Reject if the generated correct_answer is highly similar to an existing one.
        # Stage 5 embedding-based dedup catches near-duplicates at a deeper level;
        # this cheaper string-similarity check catches obvious exact/paraphrase repeats.
        generated_answer = (question_data.get("correct_answer") or "").strip()
        if generated_answer and existing_answers:
            for ea in existing_answers:
                sim = _answer_similarity(generated_answer, ea)
                if sim > 0.80:
                    return True, f"answer_repeat:{generated_answer[:40]!r}"

    # literature and topup: no pre-reject
    return False, ""


# ── Single-question strategy runner ──────────────────────────────────────────

def _run_strategy_question(
    topic: dict,
    tier: str,
    strategy: str,
    pipeline_run_id: str | None,
    existing_answers: list[str],
) -> tuple[str, str]:
    """
    Run ONE question attempt with strategy-specific pre-reject between Stage 1 and Stage 2.

    Returns (status, blocker) where:
      status  — "published" | "staged" | "pre_rejected" | "gen_failed" |
                "verify_failed" | "dedup_failed" | "score_too_low"
      blocker — the specific failure reason for waste-threshold tracking
    """
    result = pl.PipelineResult()

    # Stage 1: RAG generation
    question_data = pl.stage1_generate(topic, tier, result)
    if question_data is None:
        return "gen_failed", "generation_none"

    qtype = question_data.get("question_type", "")

    # Strategy pre-reject (before expensive API calls for stages 2–4)
    rejected, reject_reason = _pre_reject_check(
        strategy=strategy,
        qtype=qtype,
        question_data=question_data,
        existing_answers=existing_answers,
    )
    if rejected:
        log.info(f"  [pre-reject] {reject_reason}")
        return "pre_rejected", reject_reason.split(":")[0]  # just the blocker key

    # Required fields check (free — no API call)
    if not pl._has_required_fields(question_data):
        db.write_generation_error(
            pipeline_run_id=pipeline_run_id,
            topic_id=str(topic["id"]),
            question_type=qtype,
            tier=tier,
            stage_failed=1,
            error_message="Stage 1: missing required fields",
            raw_llm_output=question_data,
        )
        return "pre_rejected", "missing_required_fields"

    # Stage 2: code verification (LT / SymPy / Pint / ChemPy)
    verified = pl.stage2_verify(question_data, result)
    if not verified:
        detail = result.stage_log[-1] if result.stage_log else "Stage 2 failed"
        db.write_generation_error(
            pipeline_run_id=pipeline_run_id,
            topic_id=str(topic["id"]),
            question_type=qtype,
            tier=tier,
            stage_failed=2,
            error_message=detail,
            raw_llm_output=question_data,
        )
        return "verify_failed", "verify_failed"

    # Stage 3: consensus check
    consensus = pl.stage3_consensus(topic, tier, question_data, result)

    # Stage 4: constitutional critique
    violations = pl.stage4_constitutional(topic, tier, question_data, result)

    # Stage 5: semantic deduplication
    not_dup = pl.stage5_dedup(str(topic["id"]), question_data, result)

    # Stage 6: confidence scoring + RAG grounding + publish decision
    score, status = pl.stage6_score(
        verified=verified,
        consensus_passed=consensus,
        violations=violations,
        is_duplicate=(not not_dup),
        has_required_fields=True,
        question_data=question_data,
        topic=topic,
        result=result,
    )

    if not not_dup:
        blocker = "dedup_failed"
    elif status in ("regenerating",):
        blocker = "score_too_low"
    else:
        blocker = "ok"

    if status == "regenerating":
        db.write_generation_error(
            pipeline_run_id=pipeline_run_id,
            topic_id=str(topic["id"]),
            question_type=qtype,
            tier=tier,
            stage_failed=6,
            error_message=(
                f"Stage 6: score={score:.0f} below threshold or RAG grounding failed"
            ),
            raw_llm_output={
                "question_text": question_data.get("question_text"),
                "score": score,
                "is_duplicate": not not_dup,
                "violations": violations,
            },
        )
        return "score_too_low", blocker

    # Write to DB (published or staged)
    db.write_question(
        str(topic["id"]), tier, question_data, status, score,
        generator_version=config.PIPELINE_VERSION,
        verifier_version=result.verifier_version,
    )
    return status, "ok"


# ── Per-topic recovery loop ───────────────────────────────────────────────────

def _recover_topic(
    topic: dict,
    strategy: str,
    dry_run: bool,
) -> dict:
    """
    Run the closed-loop recovery for one topic.

    Returns a summary dict:
      slug, title, before, after, added, status,
      waste_blocked_tier (or None), waste_dominant_blocker, tiers_run
    """
    slug = topic["slug"]
    tid = str(topic["id"])

    before = count_published(tid)
    log.info(f"\n{'─'*60}")
    log.info(f"  {topic['title']} ({topic['subject_name']}, {topic['year_group_label']})")
    log.info(f"  Strategy: {strategy!r}  |  Before: {before} published")

    summary = {
        "slug": slug,
        "title": topic["title"],
        "subject": topic["subject_name"],
        "year": topic["year_group_label"],
        "strategy": strategy,
        "before": before,
        "after": before,
        "added": 0,
        "status": "HOLD",
        "waste_blocked_tier": None,
        "waste_dominant_blocker": None,
        "tiers_run": [],
    }

    if before >= MIN_TARGET:
        log.info(f"  Already at {before} published — skipping.")
        summary["status"] = "ALREADY_OK"
        return summary

    if dry_run:
        needed = max(0, MIN_TARGET - before)
        per_tier_budget = min(needed + BUFFER, MAX_PER_TIER)
        log.info(f"  DRY RUN: would attempt {per_tier_budget}/tier × {len(TIERS)} tiers")
        summary["status"] = "DRY_RUN"
        return summary

    # Fetch existing published answers once (for science_diversity pre-reject)
    existing_answers = get_published_answers(tid) if strategy == "science_diversity" else []

    # Create a pipeline run record for tracking
    run_id = db.create_pipeline_run(
        run_type=f"recover-{strategy}",
        year_group=topic["year_group_label"],
        subject=topic["subject_name"],
        topic_id=tid,
        tier="all",
    )

    total_published = 0
    waste_blocked = False

    for tier in TIERS:
        current = count_published(tid)
        if current >= MIN_TARGET:
            log.info(f"  [{tier:9s}] Reached {current} published — stopping early")
            break

        needed = MIN_TARGET - current
        budget = min(needed + BUFFER, MAX_PER_TIER)
        log.info(f"  [{tier:9s}] current={current}  needed={needed}  budget={budget}")

        blocker_counter: Counter = Counter()
        tier_published = 0
        tier_pre_rejected = 0

        for attempt_num in range(budget):
            # Re-check published count
            current = count_published(tid)
            if current >= MIN_TARGET:
                log.info(f"  [{tier:9s}] Reached target at attempt {attempt_num}")
                break

            # Token-waste protection: stop if same blocker dominates
            if blocker_counter:
                dominant_blocker, dominant_count = blocker_counter.most_common(1)[0]
                if dominant_count >= WASTE_THRESHOLD:
                    log.warning(
                        f"  [{tier:9s}] WASTE_PROTECTION: dominant_blocker={dominant_blocker!r} "
                        f"appeared {dominant_count} times — stopping tier. "
                        f"Topic needs prompt-strategy change."
                    )
                    mark_needs_strategy_change(tid, slug, dominant_blocker)
                    summary["waste_blocked_tier"] = tier
                    summary["waste_dominant_blocker"] = dominant_blocker
                    waste_blocked = True
                    break

            # Update existing_answers for science_diversity pre-reject
            if strategy == "science_diversity" and attempt_num % 5 == 0:
                existing_answers = get_published_answers(tid)

            # Run one question through the strategy-filtered pipeline
            status, blocker = _run_strategy_question(
                topic=topic,
                tier=tier,
                strategy=strategy,
                pipeline_run_id=run_id,
                existing_answers=existing_answers,
            )

            if status == "published":
                tier_published += 1
                total_published += 1
                # Update diversity list immediately
                if strategy == "science_diversity":
                    existing_answers = get_published_answers(tid)
                log.info(
                    f"  [{tier:9s}] attempt {attempt_num+1:2d}: ✅ published "
                    f"(total_this_topic={total_published})"
                )
            elif status == "staged":
                log.info(f"  [{tier:9s}] attempt {attempt_num+1:2d}: staged")
            elif status == "pre_rejected":
                tier_pre_rejected += 1
                blocker_counter[blocker] += 1
                log.info(
                    f"  [{tier:9s}] attempt {attempt_num+1:2d}: pre-rejected "
                    f"({blocker}) [{dict(blocker_counter)}]"
                )
            else:
                # verify_failed / gen_failed / score_too_low / dedup_failed
                blocker_counter[blocker] += 1
                log.info(
                    f"  [{tier:9s}] attempt {attempt_num+1:2d}: {status} "
                    f"({blocker}) [{dict(blocker_counter)}]"
                )

        summary["tiers_run"].append({
            "tier": tier,
            "published": tier_published,
            "pre_rejected": tier_pre_rejected,
            "blocker_counts": dict(blocker_counter),
        })

        log.info(
            f"  [{tier:9s}] done: published={tier_published}  "
            f"pre_rejected={tier_pre_rejected}  blockers={dict(blocker_counter)}"
        )

        if waste_blocked:
            break

    after = count_published(tid)
    added = after - before
    summary["after"] = after
    summary["added"] = added

    gate_pass = after >= MIN_TARGET
    if gate_pass:
        summary["status"] = "PASS"
    elif waste_blocked:
        summary["status"] = "WASTE_BLOCKED"
    else:
        summary["status"] = "HOLD"

    db.complete_pipeline_run(
        run_id=run_id,
        items_attempted=sum(
            t.get("published", 0) + t.get("pre_rejected", 0) + sum(t.get("blocker_counts", {}).values())
            for t in summary["tiers_run"]
        ),
        items_published=total_published,
        items_staged=0,
        items_failed=0,
        error_log=[],
        success=True,
    )

    log.info(
        f"  RESULT: before={before}  after={after}  +{added}  "
        f"status={summary['status']}"
    )
    return summary


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Targeted recovery for weak pipeline topics.")
    parser.add_argument(
        "--strategy",
        required=True,
        choices=VALID_STRATEGIES,
        help="Recovery strategy to apply.",
    )
    parser.add_argument(
        "--slugs",
        nargs="+",
        metavar="SLUG",
        help=(
            "Space-separated list of topic slugs to target. "
            "If omitted, auto-selects from DB based on strategy."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show plan without generating anything.",
    )
    args = parser.parse_args()

    strategy = args.strategy

    if args.slugs:
        slugs = args.slugs
    else:
        slugs = get_weak_topics_for_strategy(strategy)
        if not slugs:
            print(f"\n  No weak topics found for strategy {strategy!r}. Nothing to do.\n")
            sys.exit(0)
        log.info(f"Auto-selected {len(slugs)} topic(s) for strategy {strategy!r}: {slugs}")

    start_time = time.time()

    print(f"\n{'='*72}")
    print(f"  Recover-Weak-Topics — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Strategy: {strategy}  |  Topics: {len(slugs)}  |  "
          f"{'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"  Waste threshold: {WASTE_THRESHOLD} same-blocker failures per tier")
    print(f"  Max attempts: {MAX_PER_TIER}/tier  |  Target: {MIN_TARGET} published Q")
    print(f"{'='*72}\n")

    summaries = []

    for slug in slugs:
        topic = get_topic_by_slug(slug)
        if not topic:
            log.warning(f"Topic slug not found in DB: {slug!r}")
            summaries.append({
                "slug": slug, "title": "NOT_FOUND", "subject": "", "year": "",
                "strategy": strategy, "before": 0, "after": 0, "added": 0,
                "status": "NOT_FOUND",
                "waste_blocked_tier": None, "waste_dominant_blocker": None,
                "tiers_run": [],
            })
            continue

        s = _recover_topic(topic=topic, strategy=strategy, dry_run=args.dry_run)
        summaries.append(s)

    elapsed = int(time.time() - start_time)

    # ── Final report ──────────────────────────────────────────────────────────
    print(f"\n{'='*72}")
    print(f"  RECOVERY COMPLETE — {elapsed // 60}m {elapsed % 60}s")
    print(f"\n  Strategy: {strategy}")
    print(f"\n  {'Slug':<46} {'Q':>4} {'LC':>4} {'Added':>5} {'Status':<16} {'Notes'}")
    print(f"  {'─'*86}")

    pass_count = 0
    hold_count = 0
    waste_count = 0
    not_found_count = 0

    for s in summaries:
        status_sym = {
            "PASS":       "✅",
            "HOLD":       "🔒",
            "WASTE_BLOCKED": "⛔",
            "ALREADY_OK": "✓ ",
            "DRY_RUN":    "🔍",
            "NOT_FOUND":  "❓",
        }.get(s["status"], "?")

        notes = ""
        if s["status"] == "WASTE_BLOCKED":
            notes = f"blocker={s.get('waste_dominant_blocker', '?')!r} on {s.get('waste_blocked_tier', '?')} tier → needs_prompt_strategy_change"
        elif s["status"] == "HOLD":
            notes = f"still {s['after']}/{MIN_TARGET} Q"
        elif s["status"] == "PASS":
            notes = f"+{s['added']} added"
        elif s["status"] == "ALREADY_OK":
            notes = f"{s['before']} Q (no action needed)"

        print(
            f"  {s['slug']:<46} {s['after']:>4} {'?':>4} {s.get('added', 0):>5} "
            f"{status_sym} {s['status']:<14} {notes}"
        )

        if s["status"] == "PASS":
            pass_count += 1
        elif s["status"] == "WASTE_BLOCKED":
            waste_count += 1
        elif s["status"] == "HOLD":
            hold_count += 1
        elif s["status"] == "NOT_FOUND":
            not_found_count += 1

    print(f"\n  {'─'*72}")
    print(f"  PASS: {pass_count}  HOLD: {hold_count}  WASTE_BLOCKED: {waste_count}  NOT_FOUND: {not_found_count}")
    print()

    if hold_count > 0 or waste_count > 0:
        print("  NEXT STEPS:")
        waste_slugs = [s["slug"] for s in summaries if s["status"] == "WASTE_BLOCKED"]
        hold_slugs = [s["slug"] for s in summaries if s["status"] == "HOLD"]

        if waste_slugs:
            print(f"  ⛔ WASTE_BLOCKED — manual prompt review needed:")
            for slug in waste_slugs:
                s = next(x for x in summaries if x["slug"] == slug)
                print(f"     • {slug}: dominant blocker = {s.get('waste_dominant_blocker', 'unknown')!r}")
            print(f"     Run: /root/pipeline-venv/bin/python3 scripts/diagnose-content-blockers.py --slug SLUG")

        if hold_slugs:
            slugs_str = " ".join(hold_slugs)
            print(f"  🔒 HOLD — try a different strategy or re-run after pipeline.py fix:")
            print(f"     /root/pipeline-venv/bin/python3 scripts/recover-weak-topics.py \\")
            print(f"       --strategy topup --slugs {slugs_str}")
    print()


if __name__ == "__main__":
    try:
        with pipeline_lock("recover"):
            main()
    except PipelineLockError as _e:
        print(_e)
        sys.exit(1)
