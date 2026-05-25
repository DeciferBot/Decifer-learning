"""
pipeline_lock.py — Singleton process lock for Decifer Learning content pipeline.

Prevents duplicate generation jobs from running simultaneously.
Lock files live in /tmp/decifer-pipeline-locks/ and are named by job key,
e.g. "batch-year-2", "batch-year-6", "topup", "learn-content".

Usage:
    from pipeline_lock import acquire_lock, release_lock, PipelineLockError

    lock = acquire_lock("batch-year-2")   # raises PipelineLockError if already running
    try:
        ...
    finally:
        release_lock(lock)

Or use the context manager:
    from pipeline_lock import pipeline_lock

    with pipeline_lock("batch-year-2"):
        ...

Stale locks (process no longer alive) are automatically broken.
"""

from __future__ import annotations

import fcntl
import logging
import os
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger("pipeline.lock")

LOCK_DIR = Path("/tmp/decifer-pipeline-locks")


class PipelineLockError(RuntimeError):
    """Raised when a lock cannot be acquired because another process holds it."""


@dataclass
class LockHandle:
    key: str
    lock_file: Path
    fd: int


def acquire_lock(key: str) -> LockHandle:
    """
    Acquire an exclusive lock for the given job key.

    key examples: "batch-year-2", "batch-year-3", "batch-year-6", "batch-year-7",
                  "topup", "learn-content"

    Raises PipelineLockError if the lock is held by a live process.
    Automatically breaks stale locks (process dead).
    Returns a LockHandle that must be passed to release_lock() when done.
    """
    LOCK_DIR.mkdir(parents=True, exist_ok=True)
    lock_file = LOCK_DIR / f"{key}.lock"

    # Check for stale lock first
    if lock_file.exists():
        try:
            existing_pid = int(lock_file.read_text().strip())
            # Check if the process is alive
            try:
                os.kill(existing_pid, 0)  # signal 0 = existence check only
                # Process is alive — lock is valid
                raise PipelineLockError(
                    f"\n\n{'='*60}\n"
                    f"  DUPLICATE JOB BLOCKED: '{key}' is already running.\n"
                    f"  Existing PID: {existing_pid}\n"
                    f"  Lock file: {lock_file}\n"
                    f"\n"
                    f"  If that process is genuinely stuck, remove the lock with:\n"
                    f"    rm {lock_file}\n"
                    f"{'='*60}\n"
                )
            except ProcessLookupError:
                # PID does not exist — stale lock, break it
                log.warning(f"Breaking stale lock for '{key}' (PID {existing_pid} no longer running)")
                lock_file.unlink(missing_ok=True)
        except (ValueError, OSError):
            # Corrupt or unreadable lock file — remove it
            lock_file.unlink(missing_ok=True)

    # Open and exclusively lock the file
    fd = os.open(str(lock_file), os.O_CREAT | os.O_RDWR)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        # Read PID from file for a better error message
        try:
            existing_pid = int(lock_file.read_text().strip())
        except Exception:
            existing_pid = "unknown"
        raise PipelineLockError(
            f"\n\n{'='*60}\n"
            f"  DUPLICATE JOB BLOCKED: '{key}' is already running.\n"
            f"  Existing PID: {existing_pid}\n"
            f"  Lock file: {lock_file}\n"
            f"\n"
            f"  To force-clear: rm {lock_file}\n"
            f"{'='*60}\n"
        )

    # Write our PID into the lock file
    os.truncate(fd, 0)
    os.write(fd, str(os.getpid()).encode())
    log.info(f"Lock acquired: '{key}' (PID {os.getpid()}) → {lock_file}")
    return LockHandle(key=key, lock_file=lock_file, fd=fd)


def release_lock(handle: LockHandle) -> None:
    """Release a lock acquired by acquire_lock()."""
    try:
        fcntl.flock(handle.fd, fcntl.LOCK_UN)
        os.close(handle.fd)
    except OSError:
        pass
    try:
        handle.lock_file.unlink(missing_ok=True)
    except OSError:
        pass
    log.info(f"Lock released: '{handle.key}'")


@contextmanager
def pipeline_lock(key: str):
    """
    Context manager that acquires and releases a pipeline lock.

    with pipeline_lock("batch-year-2"):
        run_batch()

    Raises PipelineLockError immediately if another process holds the lock.
    """
    handle = acquire_lock(key)
    try:
        yield handle
    finally:
        release_lock(handle)
