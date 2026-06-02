"""
safety.py — Autopilot safety guards for the Decifer Learning content pipeline.

The autopilot must refuse to run if any of these conditions are true:
  1. .PIPELINE_STOP sentinel is missing (and the command is not a dry-run)
  2. A Learning generation lock is active at /tmp/decifer-pipeline-locks/
  3. The target job is not in the queue
  4. The job attempts to touch more than MAX_TOPICS_PER_RUN topics
  5. Any path or process reference matches Decifer Trading patterns

These checks are called from the autopilot plan and execution commands.
They are NEVER bypassed — if a check fails the caller must abort.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# Paths
_REPO_ROOT       = Path(__file__).resolve().parent.parent.parent.parent
PIPELINE_STOP    = _REPO_ROOT / ".PIPELINE_STOP"
LOCK_DIR         = Path("/tmp/decifer-pipeline-locks")

# Limits
MAX_TOPICS_PER_RUN = 5  # hard ceiling on topics touched by a single autopilot run

# Patterns that must never appear in autopilot job arguments — trading guard.
# Hyphenated topic slugs (e.g. "trade-and-the-global-economy") create word
# boundaries at every hyphen, so only use \b for terms that are safe in slug
# context (i.e. would never appear as a hyphen-separated slug segment).
# "trade" is intentionally absent — covered by "trading" and too common in
# legitimate curriculum topics (Geography trade units).
_TRADING_PATTERNS = re.compile(
    r"trading"           # catches "decifer-trading", "trading-platform", etc.
    r"|alpaca"           # the brokerage, never a curriculum slug
    r"|ticker"           # unambiguously financial
    r"|crypto"           # unambiguously financial
    r"|portfolio"        # unambiguously financial in this context
    r"|\bstock\b",       # safe: "livestock" won't match (\b needs non-word before 's')
    re.IGNORECASE,
)


@dataclass(frozen=True)
class SafetyCheckResult:
    passed: bool
    reason: str


def check_pipeline_stop(allow_dry_run: bool = True) -> SafetyCheckResult:
    """Pass if .PIPELINE_STOP exists (generation is properly controlled)."""
    if PIPELINE_STOP.exists():
        return SafetyCheckResult(passed=True, reason=".PIPELINE_STOP is active — gate OK")
    if allow_dry_run:
        return SafetyCheckResult(
            passed=True,
            reason=".PIPELINE_STOP missing but dry-run mode allows read-only planning",
        )
    return SafetyCheckResult(
        passed=False,
        reason=(
            f".PIPELINE_STOP not found at {PIPELINE_STOP}. "
            "Create it before running any generation job: touch .PIPELINE_STOP"
        ),
    )


def check_no_active_lock(exclude_key: Optional[str] = None) -> SafetyCheckResult:
    """Pass if no Learning pipeline lock is currently held."""
    if not LOCK_DIR.exists():
        return SafetyCheckResult(passed=True, reason="No lock directory found — no active locks")

    locks = [
        p.name for p in LOCK_DIR.iterdir()
        if p.suffix == ".lock" and (exclude_key is None or p.stem != exclude_key)
    ]
    if locks:
        return SafetyCheckResult(
            passed=False,
            reason=f"Active pipeline lock(s): {locks}. Wait for the running job to finish.",
        )
    return SafetyCheckResult(passed=True, reason="No active locks")


def check_topic_limit(topic_count: int) -> SafetyCheckResult:
    """Pass if the planned job count does not exceed MAX_TOPICS_PER_RUN."""
    if topic_count <= MAX_TOPICS_PER_RUN:
        return SafetyCheckResult(
            passed=True,
            reason=f"Topic count {topic_count} ≤ {MAX_TOPICS_PER_RUN} — within limit",
        )
    return SafetyCheckResult(
        passed=False,
        reason=(
            f"Job would touch {topic_count} topics, exceeding limit of {MAX_TOPICS_PER_RUN}. "
            "Split into multiple queue entries or raise MAX_TOPICS_PER_RUN explicitly."
        ),
    )


def check_no_trading_reference(text: str) -> SafetyCheckResult:
    """Pass if the text contains no Decifer Trading references."""
    match = _TRADING_PATTERNS.search(text)
    if match:
        return SafetyCheckResult(
            passed=False,
            reason=(
                f"Trading-related term {match.group()!r} found in autopilot job. "
                "The Learning autopilot must never reference Decifer Trading paths or processes."
            ),
        )
    return SafetyCheckResult(passed=True, reason="No trading references found")


def check_job_in_queue(job_id: Optional[str]) -> SafetyCheckResult:
    """Pass if the job exists in the queue (or if job_id is None for dry-run)."""
    if job_id is None:
        return SafetyCheckResult(passed=True, reason="No job_id specified — dry-run check skipped")
    # Lazy import to avoid circular dependency
    from autopilot.work_queue import get_job
    job = get_job(job_id)
    if job is None:
        return SafetyCheckResult(
            passed=False,
            reason=f"Job {job_id!r} not found in queue. Only queued jobs may be executed.",
        )
    return SafetyCheckResult(passed=True, reason=f"Job {job_id!r} found in queue with status={job.status!r}")


def run_all_checks(
    job_texts: Optional[list[str]] = None,
    topic_count: int = 0,
    job_id: Optional[str] = None,
    is_dry_run: bool = True,
    exclude_lock: Optional[str] = None,
) -> tuple[bool, list[SafetyCheckResult]]:
    """Run all safety checks. Returns (all_passed, [results]).

    Args:
        job_texts:    List of strings from the job (topic slugs, reasons, etc.)
                      checked against trading patterns.
        topic_count:  Number of topics the planned run would touch.
        job_id:       If executing a specific job, its ID.
        is_dry_run:   Whether this is a planning-only (read-only) run.
        exclude_lock: Lock key to exclude from the active-lock check.
    """
    checks = [
        check_pipeline_stop(allow_dry_run=is_dry_run),
        check_no_active_lock(exclude_key=exclude_lock),
        check_topic_limit(topic_count),
        check_job_in_queue(job_id),
    ]

    for text in (job_texts or []):
        checks.append(check_no_trading_reference(text))

    all_passed = all(c.passed for c in checks)
    return all_passed, checks


def assert_safe(
    job_texts: Optional[list[str]] = None,
    topic_count: int = 0,
    job_id: Optional[str] = None,
    is_dry_run: bool = True,
    exclude_lock: Optional[str] = None,
) -> None:
    """Run all checks and raise RuntimeError on the first failure."""
    ok, results = run_all_checks(
        job_texts=job_texts,
        topic_count=topic_count,
        job_id=job_id,
        is_dry_run=is_dry_run,
        exclude_lock=exclude_lock,
    )
    if not ok:
        failures = [r.reason for r in results if not r.passed]
        raise RuntimeError("Autopilot safety check failed:\n" + "\n".join(f"  • {f}" for f in failures))
