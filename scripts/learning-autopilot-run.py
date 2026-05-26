"""
learning-autopilot-run.py — Execute the next batch of queued content jobs.

Dequeues jobs from the work queue and runs them one at a time using the
appropriate pipeline script. Manages .PIPELINE_STOP: it is temporarily
removed for each job and restored unconditionally when done.

Usage:
  /root/pipeline-venv/bin/python3 scripts/learning-autopilot-run.py
  /root/pipeline-venv/bin/python3 scripts/learning-autopilot-run.py --count 3
  /root/pipeline-venv/bin/python3 scripts/learning-autopilot-run.py --dry-run
  /root/pipeline-venv/bin/python3 scripts/learning-autopilot-run.py --job-id <uuid>

Safety:
  - .PIPELINE_STOP must exist before running (it is restored after each job)
  - Only runs jobs that are in the work queue
  - Maximum --count = 5 (MAX_TOPICS_PER_RUN)
  - No Decifer Trading paths or processes may be referenced in any job

Exit codes:
  0 — all jobs completed successfully
  2 — safety check failed (PIPELINE_STOP missing, lock active, etc.)
  3 — one or more jobs failed (partial success)
  1 — unexpected error
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("learning-autopilot-run")

# ── Environment ───────────────────────────────────────────────────────────────

_env_file = Path(__file__).parent.parent / ".env.local"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _k, _, _v = _line.partition("=")
        _k = _k.strip(); _v = _v.strip().strip('"').strip("'")
        if _k and _v:
            os.environ[_k] = _v

if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

# Add pipeline to path
_PIPELINE_DIR = Path(__file__).parent.parent / "services" / "content-pipeline"
sys.path.insert(0, str(_PIPELINE_DIR))

_STOP_GUARD = Path(__file__).parent.parent / ".PIPELINE_STOP"


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Execute queued autopilot content jobs.")
    parser.add_argument(
        "--count", type=int, default=1,
        help="Number of jobs to execute (default 1, max 5)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show commands without executing; does not remove .PIPELINE_STOP"
    )
    parser.add_argument(
        "--job-id", metavar="UUID",
        help="Execute a specific job by ID instead of dequeuing by priority"
    )
    args = parser.parse_args()

    # Check PIPELINE_STOP exists (except for dry-run)
    if not args.dry_run and not _STOP_GUARD.exists():
        log.error(
            ".PIPELINE_STOP not found. "
            "The runner uses PIPELINE_STOP as a gate — it must exist before running. "
            f"Create it: echo 'PIPELINE STOP ACTIVE' > {_STOP_GUARD}"
        )
        sys.exit(2)

    from autopilot.runner import run_next_batch, print_run_summary
    from autopilot.work_queue import list_jobs, JobStatus

    # Show queue state
    queued = list_jobs(status=JobStatus.QUEUED.value)
    if not queued and not args.job_id:
        print("Queue is empty. Run 'npm run learning:autopilot:queue' to populate it.")
        sys.exit(0)

    log.info(
        f"Queue has {len(queued)} job(s).  "
        f"Running count={args.count}  dry_run={args.dry_run}  "
        f"job_id={args.job_id!r}"
    )

    try:
        results = run_next_batch(
            count=args.count,
            dry_run=args.dry_run,
            job_id=args.job_id,
        )
    except RuntimeError as e:
        log.error(f"Safety check failed: {e}")
        sys.exit(2)
    except Exception as e:
        log.exception(f"Unexpected error: {e}")
        sys.exit(1)
    finally:
        # Guarantee PIPELINE_STOP is restored even if runner.py had an unhandled error
        if not args.dry_run and not _STOP_GUARD.exists():
            _STOP_GUARD.write_text("PIPELINE STOP ACTIVE: Decifer Learning content generation is disabled\n")
            log.warning("PIPELINE_STOP was missing after run — restored automatically.")

    print_run_summary(results)

    failed = [r for r in results if r.final_status not in ("complete", "verify_pending", "publish_pending")]
    sys.exit(3 if failed else 0)


if __name__ == "__main__":
    main()
