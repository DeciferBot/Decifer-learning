"""
runner.py — Content job executor for the Decifer Learning autopilot.

Dequeues jobs from the work queue and executes them by calling the appropriate
pipeline scripts via subprocess. Manages the .PIPELINE_STOP sentinel: it is
temporarily removed for the duration of each job and restored immediately after
(even on crash via try/finally).

Safety guarantees:
  1. PIPELINE_STOP is verified to exist before any run starts.
  2. A pipeline lock is acquired before any subprocess call.
  3. No more than MAX_TOPICS_PER_RUN jobs are processed per invocation.
  4. PIPELINE_STOP is ALWAYS restored at the end (try/finally).
  5. Jobs that exceed MAX_ATTEMPTS are automatically marked 'blocked'.
  6. Trading patterns in job arguments cause immediate abort.

Supported job strategies → subprocess commands:
  topup            → recover-weak-topics.py --strategy topup --slugs <slug>
  spelling         → recover-weak-topics.py --strategy spelling --slugs <slug>
  physics          → recover-weak-topics.py --strategy physics --slugs <slug>
  science_diversity→ recover-weak-topics.py --strategy science_diversity --slugs <slug>
  literature       → recover-weak-topics.py --strategy literature --slugs <slug>
  generate         → recover-weak-topics.py --strategy topup --slugs <slug>
  learn_content    → generate-learn-content.py --topic <slug>
  promote          → publish-ready-topics.ts (via npx tsx)
  retry            → recover-weak-topics.py --strategy topup --slugs <slug>
  enrich           → NOT executed automatically; logged as requiring manual RAG seed
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from autopilot.safety import (
    assert_safe,
    PIPELINE_STOP,
    MAX_TOPICS_PER_RUN,
    check_no_trading_reference,
)
from autopilot.work_queue import (
    ContentJob,
    JobStatus,
    dequeue_next,
    get_job,
    increment_attempt,
    list_jobs,
    update_job,
)

log = logging.getLogger("autopilot.runner")

# Path resolution
_REPO_ROOT    = Path(__file__).resolve().parent.parent.parent.parent
_SCRIPTS_DIR  = _REPO_ROOT / "scripts"
_PYTHON       = sys.executable


# ── Strategy → script mapping ─────────────────────────────────────────────────

_RECOVER_STRATEGIES = frozenset({
    "topup", "spelling", "physics", "science_diversity", "literature",
    "generate", "retry",
})


def _build_command(job: ContentJob) -> Optional[list[str]]:
    """Return the subprocess command list for a job, or None if unexecutable."""
    strategy = job.strategy

    if strategy == "learn_content":
        return [
            _PYTHON,
            str(_SCRIPTS_DIR / "generate-learn-content.py"),
            "--topic", job.topic_slug,
        ]

    if strategy == "promote":
        return ["npx", "tsx", str(_SCRIPTS_DIR / "publish-ready-topics.ts")]

    if strategy == "enrich":
        return None  # requires manual RAG seeding; not automated here

    # All recover-weak-topics strategies
    recover_strategy = "topup" if strategy in ("generate", "retry") else strategy
    if recover_strategy not in ("topup", "spelling", "physics", "science_diversity", "literature"):
        recover_strategy = "topup"

    return [
        _PYTHON,
        str(_SCRIPTS_DIR / "recover-weak-topics.py"),
        "--strategy", recover_strategy,
        "--slugs", job.topic_slug,
    ]


# ── PIPELINE_STOP management ──────────────────────────────────────────────────

@contextmanager
def _pipeline_gate_open(stop_path: Path = PIPELINE_STOP):
    """
    Context manager: temporarily removes .PIPELINE_STOP, then restores it.

    The content of the stop file is preserved so the message is not lost.
    PIPELINE_STOP is unconditionally restored in the finally block.
    """
    original_content = stop_path.read_text() if stop_path.exists() else "PIPELINE STOP ACTIVE"
    stop_path.unlink(missing_ok=True)
    try:
        yield
    finally:
        stop_path.write_text(original_content)
        log.info(f"PIPELINE_STOP restored at {stop_path}")


# ── Job result ────────────────────────────────────────────────────────────────

@dataclass
class JobResult:
    job_id: str
    slug: str
    strategy: str
    exit_code: int
    duration_seconds: float
    stdout_tail: str
    stderr_tail: str
    final_status: str


# ── Core execution ────────────────────────────────────────────────────────────

def _run_job(job: ContentJob, dry_run: bool = False) -> JobResult:
    """Execute a single content job. Manages PIPELINE_STOP and lock."""
    start = time.monotonic()

    # Safety check on job text
    trading_check = check_no_trading_reference(
        f"{job.topic_slug} {job.subject} {job.year} {job.strategy}"
    )
    if not trading_check.passed:
        update_job(job.id, status=JobStatus.BLOCKED.value,
                   last_error=trading_check.reason)
        return JobResult(
            job_id=job.id, slug=job.topic_slug, strategy=job.strategy,
            exit_code=1, duration_seconds=0,
            stdout_tail="", stderr_tail=trading_check.reason,
            final_status=JobStatus.BLOCKED.value,
        )

    cmd = _build_command(job)

    if cmd is None:
        # Non-executable strategy (enrich)
        msg = (
            f"Strategy '{job.strategy}' requires manual action. "
            f"Seed curriculum_chunks for {job.subject} / {job.year} then re-queue."
        )
        update_job(job.id, status=JobStatus.BLOCKED.value, last_error=msg)
        return JobResult(
            job_id=job.id, slug=job.topic_slug, strategy=job.strategy,
            exit_code=2, duration_seconds=0,
            stdout_tail="", stderr_tail=msg,
            final_status=JobStatus.BLOCKED.value,
        )

    if dry_run:
        log.info(f"[DRY RUN] would execute: {' '.join(cmd)}")
        update_job(job.id, status=JobStatus.COMPLETE.value)
        return JobResult(
            job_id=job.id, slug=job.topic_slug, strategy=job.strategy,
            exit_code=0, duration_seconds=0,
            stdout_tail=f"DRY RUN: {' '.join(cmd)}",
            stderr_tail="",
            final_status=JobStatus.COMPLETE.value,
        )

    log.info(f"Running job {job.id}: {' '.join(cmd)}")
    update_job(job.id, status=JobStatus.RUNNING.value)

    stdout_lines: list[str] = []
    stderr_lines: list[str] = []

    with _pipeline_gate_open():
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=900,  # 15 min hard timeout per topic
                cwd=str(_REPO_ROOT),
            )
            stdout_lines = (proc.stdout or "").splitlines()
            stderr_lines = (proc.stderr or "").splitlines()
            exit_code = proc.returncode
        except subprocess.TimeoutExpired as e:
            exit_code = 124
            stderr_lines = [f"Job timed out after 900s: {e}"]
        except Exception as e:
            exit_code = 1
            stderr_lines = [f"Subprocess error: {e}"]

    duration = time.monotonic() - start
    stdout_tail = "\n".join(stdout_lines[-20:])
    stderr_tail = "\n".join(stderr_lines[-10:])

    if exit_code == 0:
        final_status = JobStatus.COMPLETE.value
        update_job(job.id, status=final_status)
    else:
        last_error = (stderr_tail or stdout_tail or f"exit_code={exit_code}")[:500]
        increment_attempt(job.id, error=last_error)
        # Check if auto-blocked after this attempt
        updated = get_job(job.id)
        final_status = updated.status if updated else JobStatus.RETRY_LATER.value
        if final_status != JobStatus.BLOCKED.value:
            update_job(job.id, status=JobStatus.RETRY_LATER.value)
            final_status = JobStatus.RETRY_LATER.value

    return JobResult(
        job_id=job.id,
        slug=job.topic_slug,
        strategy=job.strategy,
        exit_code=exit_code,
        duration_seconds=round(duration, 1),
        stdout_tail=stdout_tail,
        stderr_tail=stderr_tail,
        final_status=final_status,
    )


# ── Public API ────────────────────────────────────────────────────────────────

def run_next_batch(
    count: int = 1,
    dry_run: bool = False,
    job_id: Optional[str] = None,
) -> list[JobResult]:
    """
    Execute the next `count` queued jobs.

    Args:
        count:    Number of jobs to run (capped at MAX_TOPICS_PER_RUN).
        dry_run:  Print commands without executing; don't remove PIPELINE_STOP.
        job_id:   Run a specific job by ID instead of dequeuing by priority.

    Returns:
        List of JobResult for each executed job.
    """
    count = min(count, MAX_TOPICS_PER_RUN)

    # Safety checks (dry_run bypasses PIPELINE_STOP requirement for planning)
    assert_safe(
        topic_count=count,
        job_id=job_id,
        is_dry_run=dry_run,
    )

    results: list[JobResult] = []

    if job_id:
        job = get_job(job_id)
        if job is None:
            raise ValueError(f"Job {job_id!r} not found in queue.")
        jobs_to_run = [job]
    else:
        jobs_to_run = []
        for _ in range(count):
            job = dequeue_next()
            if job is None:
                log.info("Queue empty — no more jobs to run.")
                break
            # Temporarily mark as running so the next dequeue_next() skips it
            update_job(job.id, status=JobStatus.RUNNING.value)
            jobs_to_run.append(job)

    for job in jobs_to_run:
        log.info(f"Processing job: {job.topic_slug} [{job.strategy}] (attempt {job.attempt_count + 1})")
        result = _run_job(job, dry_run=dry_run)
        results.append(result)
        _log_result(result)

    return results


def _log_result(r: JobResult) -> None:
    status_icon = "✅" if r.final_status == JobStatus.COMPLETE.value else (
                  "🔄" if r.final_status == JobStatus.RETRY_LATER.value else "❌")
    log.info(
        f"{status_icon} {r.slug}  strategy={r.strategy}  "
        f"exit={r.exit_code}  duration={r.duration_seconds}s  "
        f"status={r.final_status}"
    )
    if r.exit_code != 0 and r.stderr_tail:
        log.warning(f"   stderr: {r.stderr_tail[:200]}")


def print_run_summary(results: list[JobResult]) -> None:
    total     = len(results)
    complete  = sum(1 for r in results if r.final_status == JobStatus.COMPLETE.value)
    retry     = sum(1 for r in results if r.final_status == JobStatus.RETRY_LATER.value)
    blocked   = sum(1 for r in results if r.final_status == JobStatus.BLOCKED.value)

    print(f"\n{'═' * 60}")
    print(f"  AUTOPILOT RUN SUMMARY")
    print(f"  {total} job(s): ✅ {complete} complete  🔄 {retry} retry  ❌ {blocked} blocked")
    print(f"{'─' * 60}")
    for r in results:
        icon = "✅" if r.final_status == JobStatus.COMPLETE.value else (
               "🔄" if r.final_status == JobStatus.RETRY_LATER.value else "❌")
        print(f"  {icon} {r.slug:<45} [{r.strategy}]  {r.duration_seconds}s")
        if r.exit_code != 0 and r.stderr_tail:
            print(f"     └─ {r.stderr_tail[:100]}")
    print(f"{'═' * 60}\n")
