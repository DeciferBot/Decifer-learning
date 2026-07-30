"""
queue_builder.py — Populate the work queue from current coverage state.

Scans every non-LIVE topic, runs failure classification on blocked topics,
and enqueues the appropriate recovery job.

Rules:
  LIVE                  → skip
  QUARANTINED           → skip (anomaly detection handles these)
  BLOCKED, errors ≥ HIGH_ERROR_SKIP → skip (too stuck; needs human)
  BLOCKED, errors  < HIGH_ERROR_SKIP → classify last_error; skip if
                          MANUAL_REVIEW_REQUIRED, UNSAFE_CONTENT, or
                          NEEDS_RAG_ENRICHMENT; enqueue otherwise
  READY_FOR_TOPUP       → enqueue (strategy inferred from slug)
  READY_FOR_GENERATION  → enqueue generate
  NEED_Q                → enqueue topup (if has chunks) or skip
  WEAK                  → skip (anomaly detection will regenerate flagged Q)
  EMPTY                 → skip unless has RAG chunks

Output: populated work queue + printed summary.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from autopilot.coverage_scanner import (
    CoverageState,
    TopicCoverage,
    scan_coverage,
    coverage_summary,
    MIN_QUESTIONS,
)
from autopilot.failure_classifier import classify, FailureAction
from autopilot.work_queue import enqueue, list_jobs, JobStatus

log = logging.getLogger("autopilot.queue_builder")

# Topics with this many recent errors are too stuck for automated recovery
HIGH_ERROR_SKIP = 100

# Slug keywords → recover-weak-topics.py strategy
_STRATEGY_KEYWORDS: list[tuple[tuple[str, ...], str]] = [
    (("spelling", "homophones", "prefix", "suffix", "exception"),           "spelling"),
    (("forces", "energy", "electricity", "light", "sound", "waves"),        "physics"),
    (("plants", "animals", "cells", "organisms", "ecosystems", "habitats"), "science_diversity"),
    (("literature", "character", "theme", "persuasive", "narrative",
      "reading", "writing", "vocabulary", "etymology"),                     "literature"),
    (("phonics", "digraph", "phoneme", "punctuation"),                      "topup"),
]

# Per-topic published-question targets for content-limited topics: subjects where
# the curriculum genuinely contains fewer than MIN_QUESTIONS distinct questions, so
# the topic can never reach the normal target no matter how long it is worked.
#
# Graph transformations is the worked example. It has ~6 non-duplicate variants in
# total (the six archetypes in the maths_concept prompt: vertical and horizontal
# translation, reflection in each axis, and the two stretches). Every generation
# run past that hits the dedup wall, so the topic was re-queued every night, ground
# through rejects until the 900s timeout, and reported "needs a human" on every
# single queue build. There is no human fix — the content does not exist.
#
# Key = topic slug, value = the published-question count at which the topic is
# considered complete.
TOPUP_TARGET_OVERRIDES: dict[str, int] = {
    # 5 = what is currently published; the topic is at its natural ceiling.
    "y11-maths-functions-graph-transformations": 5,
}

# State → base priority (lower = higher priority in queue)
_STATE_PRIORITY: dict[CoverageState, int] = {
    CoverageState.READY_FOR_TOPUP:      1,
    CoverageState.READY_FOR_GENERATION: 2,
    CoverageState.NEED_Q:               3,
    CoverageState.BLOCKED:              4,
    CoverageState.EMPTY:                5,
}


def _infer_strategy(slug: str) -> str:
    """Return the best recover-weak-topics.py strategy for a topic slug."""
    sl = slug.lower()
    for keywords, strategy in _STRATEGY_KEYWORDS:
        if any(kw in sl for kw in keywords):
            return strategy
    return "topup"


@dataclass
class QueueDecision:
    topic_id: str
    slug: str
    action: str          # "enqueue" | "skip"
    strategy: str
    priority: int
    reason: str
    skip_reason: Optional[str] = None
    job_id: Optional[str] = None


def _decide(topic: TopicCoverage) -> QueueDecision:
    slug     = topic.slug or topic.title
    strategy = _infer_strategy(slug)
    priority = _STATE_PRIORITY.get(topic.state, 5)

    # States that are always skipped
    if topic.state == CoverageState.LIVE:
        return QueueDecision(topic.topic_id, slug, "skip", strategy, priority,
                             "", skip_reason="already LIVE")

    if topic.state in (CoverageState.QUARANTINED, CoverageState.WEAK):
        return QueueDecision(topic.topic_id, slug, "skip", strategy, priority,
                             "", skip_reason=f"{topic.state.value}: handled by anomaly detection")

    # Content-limited topics have their own target. This is checked before the
    # BLOCKED branch on purpose: such a topic accumulates errors from the dedup
    # wall, so the classifier reports MANUAL_REVIEW_REQUIRED forever even though
    # no human action exists. Treating it as complete retires that false alarm.
    cap = TOPUP_TARGET_OVERRIDES.get(slug)
    if cap is not None and topic.pub_q >= cap:
        return QueueDecision(topic.topic_id, slug, "skip", strategy, priority,
                             "", skip_reason=f"content-limited: {topic.pub_q}/{cap} published — at its natural ceiling")

    # BLOCKED with too many errors
    if topic.state == CoverageState.BLOCKED and topic.recent_errors >= HIGH_ERROR_SKIP:
        return QueueDecision(topic.topic_id, slug, "skip", strategy, priority,
                             "", skip_reason=f"BLOCKED ({topic.recent_errors} errors ≥ {HIGH_ERROR_SKIP}): manual review required")

    # BLOCKED with recoverable error count — run failure classifier
    if topic.state == CoverageState.BLOCKED:
        from autopilot.failure_classifier import classify, FailureAction
        qtype_hint = _qtype_hint_from_slug(slug)
        c = classify(
            error_message=topic.last_error or "",
            question_type=qtype_hint,
        )
        if c.action in (FailureAction.MANUAL_REVIEW_REQUIRED, FailureAction.UNSAFE_CONTENT):
            return QueueDecision(topic.topic_id, slug, "skip", strategy, priority,
                                 "", skip_reason=f"classifier: {c.action.value}")
        if c.action == FailureAction.NEEDS_RAG_ENRICHMENT:
            return QueueDecision(topic.topic_id, slug, "skip", strategy, priority,
                                 "", skip_reason="NEEDS_RAG_ENRICHMENT: seed curriculum_chunks first")
        if c.action == FailureAction.VERIFIER_FALSE_POSITIVE:
            # New verifier routing may fix this — boost priority
            priority = max(1, priority - 1)
        reason = f"{topic.state.value} ({topic.recent_errors} errors): {c.action.value} → {strategy}"
        return QueueDecision(topic.topic_id, slug, "enqueue", strategy, priority, reason)

    # NEED_Q with action=generate_learn_content — has enough Q, missing learn content
    if topic.state == CoverageState.NEED_Q and topic.recommended_action == "generate_learn_content":
        reason = f"NEED_Q: {topic.pub_q}/{MIN_QUESTIONS} Q published but no learn_content — generating LC"
        return QueueDecision(topic.topic_id, slug, "enqueue", "learn_content", 1, reason)

    # NEED_Q with action=promote — has Q+LC but not published yet
    if topic.state == CoverageState.NEED_Q and topic.recommended_action == "promote":
        reason = f"NEED_Q: {topic.pub_q}/{MIN_QUESTIONS} Q + LC present but not published — promoting"
        return QueueDecision(topic.topic_id, slug, "enqueue", "promote", 1, reason)

    # EMPTY without RAG chunks
    if topic.state == CoverageState.EMPTY and topic.chunk_count == 0:
        return QueueDecision(topic.topic_id, slug, "skip", strategy, priority,
                             "", skip_reason="EMPTY: no RAG chunks — enrich curriculum_chunks first")

    # NEED_Q without chunks
    if topic.state == CoverageState.NEED_Q and topic.chunk_count == 0:
        return QueueDecision(topic.topic_id, slug, "skip", strategy, priority,
                             "", skip_reason="NEED_Q: no RAG chunks")

    # All other states: enqueue
    reason = (
        f"{topic.state.value}: {topic.pub_q}/{MIN_QUESTIONS} Q  "
        f"(strategy={strategy}, chunks={topic.chunk_count})"
    )
    return QueueDecision(topic.topic_id, slug, "enqueue", strategy, priority, reason)


def _qtype_hint_from_slug(slug: str) -> str:
    """Return a rough question_type hint from a slug, used for failure classifier routing."""
    sl = slug.lower()
    if "spelling" in sl:        return "english_spelling"
    if "phonics" in sl:         return "english_phonics"
    if "grammar" in sl:         return "english_grammar"
    if "punctuation" in sl:     return "english_punctuation"
    if "etymology" in sl:       return "english_etymology"
    if "vocabulary" in sl:      return "english_vocabulary"
    if "comprehension" in sl:   return "english_comprehension"
    if "reading" in sl:         return "english_comprehension"
    if "literature" in sl or "character" in sl: return "english_literary_analysis"
    if "writing" in sl:         return "english_literary_analysis"
    if "forces" in sl or "energy" in sl or "electricity" in sl: return "science_physics_calculation"
    if "algebra" in sl:         return "maths_algebra"
    if "maths" in sl:           return "maths_arithmetic"
    return ""


def build_queue(
    database_url: str,
    year_filter: Optional[str] = None,
    subject_filter: Optional[str] = None,
    dry_run: bool = False,
    limit: Optional[int] = None,
) -> list[QueueDecision]:
    """Scan coverage and populate the work queue.

    Args:
        database_url:  Direct Postgres URL.
        year_filter:   Optional year group filter, e.g. "year-3".
        subject_filter: Optional subject filter, e.g. "Mathematics".
        dry_run:       If True, print decisions without writing to the queue.
        limit:         Maximum number of jobs to enqueue (None = no limit).

    Returns:
        List of QueueDecision objects (both enqueued and skipped).
    """
    topics = scan_coverage(
        database_url=database_url,
        year_filter=year_filter,
        subject_filter=subject_filter,
    )

    # Sort: READY_FOR_TOPUP first, then READY_FOR_GENERATION, etc.
    topics_sorted = sorted(
        topics,
        key=lambda t: (_STATE_PRIORITY.get(t.state, 9), -t.pub_q, t.slug),
    )

    decisions: list[QueueDecision] = []
    enqueued_count = 0

    for topic in topics_sorted:
        d = _decide(topic)
        decisions.append(d)

        if d.action == "skip":
            continue

        if limit and enqueued_count >= limit:
            d.action = "skip"
            d.skip_reason = f"limit={limit} reached"
            continue

        if not dry_run:
            job_id = enqueue(
                year=topic.year_group,
                subject=topic.subject,
                topic_slug=d.slug,
                target_question_count=MIN_QUESTIONS,
                strategy=d.strategy,
                priority=d.priority,
                reason=d.reason,
                topic_id=topic.topic_id,
            )
            d.job_id = job_id
        enqueued_count += 1

    return decisions


def print_queue_plan(decisions: list[QueueDecision], dry_run: bool = False) -> None:
    to_enqueue = [d for d in decisions if d.action == "enqueue"]
    skipped    = [d for d in decisions if d.action == "skip"]

    label = "DRY RUN — no queue writes" if dry_run else "QUEUE POPULATED"
    print(f"\n{'═' * 70}")
    print(f"  AUTOPILOT QUEUE BUILDER  [{label}]")
    print(f"  {len(to_enqueue)} jobs enqueued  |  {len(skipped)} topics skipped")
    print(f"{'═' * 70}\n")

    if to_enqueue:
        print(f"  {'Topic Slug':<45} {'Strategy':<18} Priority")
        print(f"  {'─' * 70}")
        for d in sorted(to_enqueue, key=lambda x: x.priority):
            print(f"  {d.slug[:45]:<45} {d.strategy:<18} {d.priority}")
            if d.reason:
                print(f"    └─ {d.reason[:80]}")
        print()

    skipped_notable = [d for d in skipped if "manual" in (d.skip_reason or "").lower()
                       or "needs_rag" in (d.skip_reason or "").lower()]
    if skipped_notable:
        print(f"  Topics requiring human action ({len(skipped_notable)}):")
        for d in skipped_notable[:10]:
            print(f"    • {d.slug[:45]}  — {d.skip_reason}")
        if len(skipped_notable) > 10:
            print(f"    … and {len(skipped_notable) - 10} more")
        print()

    print(f"{'═' * 70}\n")


# ── CLI entry point ───────────────────────────────────────────────────────────
# main.py's nightly autopilot invokes this module with `python -m
# autopilot.queue_builder`. Without a __main__ block that call imported the
# module, executed nothing and exited 0, so the nightly run reported success
# while building no queue at all. See scripts/learning-autopilot-queue.py for
# the fuller CLI (year/subject filters, --limit); this is the no-argument form
# the pipeline service uses.

if __name__ == "__main__":
    import argparse
    import sys
    from pathlib import Path

    # config.py lives in the pipeline root, one level above this package.
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    import config as _config

    parser = argparse.ArgumentParser(description="Populate the autopilot work queue.")
    parser.add_argument("--year", help="Filter to one year group, e.g. year-3")
    parser.add_argument("--subject", help="Filter to one subject, e.g. Maths")
    parser.add_argument("--dry-run", action="store_true", help="Plan without writing the queue")
    parser.add_argument("--limit", type=int, default=None, help="Maximum jobs to enqueue")
    args = parser.parse_args()

    if not _config.DATABASE_URL:
        print("DATABASE_URL is not set — cannot build the queue", file=sys.stderr)
        raise SystemExit(1)

    decisions = build_queue(
        database_url=_config.DATABASE_URL,
        year_filter=args.year,
        subject_filter=args.subject,
        dry_run=args.dry_run,
        limit=args.limit,
    )
    print_queue_plan(decisions, dry_run=args.dry_run)
