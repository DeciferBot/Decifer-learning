"""
learning-autopilot-queue.py — Populate the autopilot work queue from current coverage.

Scans all curriculum topics, classifies each one, and enqueues recovery jobs
for anything that is not yet LIVE.

Usage:
  /root/pipeline-venv/bin/python3 scripts/learning-autopilot-queue.py
  /root/pipeline-venv/bin/python3 scripts/learning-autopilot-queue.py --year year-3
  /root/pipeline-venv/bin/python3 scripts/learning-autopilot-queue.py --dry-run
  /root/pipeline-venv/bin/python3 scripts/learning-autopilot-queue.py --limit 5

This is a SAFE command:
  - Never generates or publishes content
  - Only writes to the local queue file (/tmp/decifer-autopilot/queue.json)
  - .PIPELINE_STOP is NOT required to populate the queue (it is only required to run)

Exit codes:
  0 — success
  1 — DB connection or environment error
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
log = logging.getLogger("learning-autopilot-queue")

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

if not os.environ.get("DATABASE_URL"):
    log.error("DATABASE_URL not set — check .env.local or DIRECT_URL env var")
    sys.exit(1)

DATABASE_URL = os.environ["DATABASE_URL"]

# Add pipeline to path
_PIPELINE_DIR = Path(__file__).parent.parent / "services" / "content-pipeline"
sys.path.insert(0, str(_PIPELINE_DIR))

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Populate autopilot work queue.")
    parser.add_argument("--year",    help="Filter to one year group, e.g. year-3")
    parser.add_argument("--subject", help="Filter to one subject, e.g. Mathematics")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show planned jobs without writing to the queue")
    parser.add_argument("--limit",   type=int, default=None,
                        help="Maximum number of jobs to enqueue")
    args = parser.parse_args()

    from autopilot.queue_builder import build_queue, print_queue_plan

    log.info(f"Building queue  year={args.year!r}  subject={args.subject!r}  "
             f"dry_run={args.dry_run}  limit={args.limit}")

    decisions = build_queue(
        database_url=DATABASE_URL,
        year_filter=args.year,
        subject_filter=args.subject,
        dry_run=args.dry_run,
        limit=args.limit,
    )
    print_queue_plan(decisions, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
