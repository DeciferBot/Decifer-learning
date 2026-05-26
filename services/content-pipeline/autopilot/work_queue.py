"""
work_queue.py — File-backed content job queue for the Decifer Learning autopilot.

Jobs are stored as JSON at QUEUE_PATH (default: /tmp/decifer-autopilot/queue.json).
All operations are atomic via a simple file-level lock; the queue is never partially
written.

Job structure:
    id                  — UUID string
    year                — e.g. "year-3"
    subject             — e.g. "Mathematics"
    topic_slug          — e.g. "addition-and-subtraction"
    topic_id            — UUID string (optional; helps pipeline routing)
    target_question_count — int (how many published Q to reach)
    strategy            — "generate" | "topup" | "retry" | "enrich" | "learn_content"
    priority            — int (lower = higher priority; 1 = urgent)
    reason              — human-readable explanation
    status              — see JobStatus enum
    attempt_count       — int
    last_error          — str | null
    created_at          — ISO 8601 timestamp
    updated_at          — ISO 8601 timestamp

Statuses:
    queued              — ready to run
    running             — picked up by a worker (claim is in-memory only)
    verify_pending      — content generated; awaiting verification pass
    publish_pending     — verified; awaiting promotion to published
    complete            — job finished successfully
    retry_later         — transient failure; re-queue after back-off
    blocked             — classified as BLOCKED; requires human review
    quarantined         — topic has been quarantined; skip until cleared
"""

from __future__ import annotations

import fcntl
import json
import os
import uuid
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

QUEUE_PATH = Path(os.environ.get("AUTOPILOT_QUEUE_PATH", "/tmp/decifer-autopilot/queue.json"))

MAX_ATTEMPTS = 5  # jobs exceeding this move to 'blocked'


class JobStatus(str, Enum):
    QUEUED          = "queued"
    RUNNING         = "running"
    VERIFY_PENDING  = "verify_pending"
    PUBLISH_PENDING = "publish_pending"
    COMPLETE        = "complete"
    RETRY_LATER     = "retry_later"
    BLOCKED         = "blocked"
    QUARANTINED     = "quarantined"


class JobStrategy(str, Enum):
    GENERATE       = "generate"
    TOPUP          = "topup"
    RETRY          = "retry"
    ENRICH         = "enrich"          # seed RAG chunks, then generate
    LEARN_CONTENT  = "learn_content"   # generate learn_content only
    PROMOTE        = "promote"         # flip is_published=true


@dataclass
class ContentJob:
    id: str
    year: str
    subject: str
    topic_slug: str
    target_question_count: int
    strategy: str
    priority: int
    reason: str
    status: str
    attempt_count: int
    last_error: Optional[str]
    created_at: str
    updated_at: str
    topic_id: Optional[str] = None

    @classmethod
    def create(
        cls,
        year: str,
        subject: str,
        topic_slug: str,
        target_question_count: int,
        strategy: str,
        priority: int,
        reason: str,
        topic_id: Optional[str] = None,
    ) -> "ContentJob":
        now = _iso_now()
        return cls(
            id=str(uuid.uuid4()),
            year=year,
            subject=subject,
            topic_slug=topic_slug,
            topic_id=topic_id,
            target_question_count=target_question_count,
            strategy=strategy,
            priority=priority,
            reason=reason,
            status=JobStatus.QUEUED.value,
            attempt_count=0,
            last_error=None,
            created_at=now,
            updated_at=now,
        )

    def as_dict(self) -> dict:
        return asdict(self)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── File I/O ──────────────────────────────────────────────────────────────────

@contextmanager
def _locked_queue():
    """Context manager that opens the queue file with an exclusive flock."""
    QUEUE_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(QUEUE_PATH), os.O_CREAT | os.O_RDWR)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        try:
            raw = os.read(fd, 10 * 1024 * 1024)  # 10 MB ceiling
            data = json.loads(raw) if raw.strip() else {"jobs": []}
        except (json.JSONDecodeError, ValueError):
            data = {"jobs": []}
        yield data
        # Write back
        encoded = json.dumps(data, indent=2).encode()
        os.lseek(fd, 0, os.SEEK_SET)
        os.truncate(fd, 0)
        os.write(fd, encoded)
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


# ── Public API ────────────────────────────────────────────────────────────────

def enqueue(
    year: str,
    subject: str,
    topic_slug: str,
    target_question_count: int,
    strategy: str,
    priority: int,
    reason: str,
    topic_id: Optional[str] = None,
) -> str:
    """Add a job to the queue. Returns the new job id.

    Idempotent: if a non-complete, non-blocked job already exists for this
    topic_slug + strategy, the existing job id is returned unchanged.
    """
    job = ContentJob.create(
        year=year,
        subject=subject,
        topic_slug=topic_slug,
        target_question_count=target_question_count,
        strategy=strategy,
        priority=priority,
        reason=reason,
        topic_id=topic_id,
    )
    with _locked_queue() as data:
        existing = [
            j for j in data["jobs"]
            if j["topic_slug"] == topic_slug
            and j["strategy"] == strategy
            and j["status"] not in (JobStatus.COMPLETE.value, JobStatus.BLOCKED.value, JobStatus.QUARANTINED.value)
        ]
        if existing:
            return existing[0]["id"]
        data["jobs"].append(job.as_dict())
    return job.id


def list_jobs(status: Optional[str] = None) -> list[ContentJob]:
    """Return all jobs, optionally filtered by status."""
    QUEUE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not QUEUE_PATH.exists():
        return []
    try:
        raw = QUEUE_PATH.read_bytes()
        data = json.loads(raw) if raw.strip() else {"jobs": []}
    except (json.JSONDecodeError, OSError):
        return []
    jobs = [ContentJob(**j) for j in data.get("jobs", [])]
    if status is not None:
        jobs = [j for j in jobs if j.status == status]
    return sorted(jobs, key=lambda j: (j.priority, j.created_at))


def get_job(job_id: str) -> Optional[ContentJob]:
    for j in list_jobs():
        if j.id == job_id:
            return j
    return None


def update_job(job_id: str, **updates) -> bool:
    """Update fields on a job by id. Returns True if found and updated."""
    updates["updated_at"] = _iso_now()
    with _locked_queue() as data:
        for j in data["jobs"]:
            if j["id"] == job_id:
                for k, v in updates.items():
                    if k in j:
                        j[k] = v
                return True
    return False


def dequeue_next() -> Optional[ContentJob]:
    """Return the highest-priority queued job without removing it from the queue."""
    queued = list_jobs(status=JobStatus.QUEUED.value)
    return queued[0] if queued else None


def increment_attempt(job_id: str, error: Optional[str] = None) -> None:
    """Increment attempt_count. Auto-blocks job if MAX_ATTEMPTS exceeded."""
    with _locked_queue() as data:
        for j in data["jobs"]:
            if j["id"] == job_id:
                j["attempt_count"] = j.get("attempt_count", 0) + 1
                j["updated_at"] = _iso_now()
                if error:
                    j["last_error"] = str(error)[:500]
                if j["attempt_count"] >= MAX_ATTEMPTS:
                    j["status"] = JobStatus.BLOCKED.value
                break


def clear_completed(keep_last: int = 20) -> int:
    """Remove complete jobs beyond the most recent `keep_last`. Returns count removed."""
    removed = 0
    with _locked_queue() as data:
        complete = [j for j in data["jobs"] if j["status"] == JobStatus.COMPLETE.value]
        complete.sort(key=lambda j: j["updated_at"], reverse=True)
        to_remove = {j["id"] for j in complete[keep_last:]}
        before = len(data["jobs"])
        data["jobs"] = [j for j in data["jobs"] if j["id"] not in to_remove]
        removed = before - len(data["jobs"])
    return removed


def queue_stats() -> dict:
    """Return per-status counts for the current queue."""
    jobs = list_jobs()
    counts: dict[str, int] = {s.value: 0 for s in JobStatus}
    for j in jobs:
        counts[j.status] = counts.get(j.status, 0) + 1
    counts["total"] = len(jobs)
    return counts
