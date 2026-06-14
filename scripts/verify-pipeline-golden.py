#!/usr/bin/env python3
"""
Golden-set regression gate for the content pipeline — CI / pre-deploy.

Runs the fixed golden bank (services/content-pipeline/tests/golden/) against the
Stage-2 deterministic verifiers and exits NON-ZERO on any regression, so a
prompt/model/verifier change that silently degrades the quality gate is caught
before deploy. Mirrors the scripts/verify-*.mjs convention (self-contained,
clear pass/fail summary, meaningful exit codes).

This is pure and offline — it imports the verifier modules directly and makes no
Anthropic / OpenAI / network calls. Golden items that declare an unavailable
runtime dependency (pint / chempy / languagetool) are SKIPPED, not failed.

Run:
    python3 scripts/verify-pipeline-golden.py
    # or with the pipeline venv that has all deps installed:
    services/content-pipeline/.venv/bin/python3 scripts/verify-pipeline-golden.py

Exit codes:
    0 — every golden item behaved as expected (or was skipped for a missing dep)
    1 — at least one golden item regressed (a good item rejected, or bad item passed)
    2 — harness/setup error (fixture missing, verifier import failed)
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
_PIPELINE_DIR = _REPO_ROOT / "services" / "content-pipeline"
_FIXTURE = _PIPELINE_DIR / "tests" / "golden" / "golden_items.json"

sys.path.insert(0, str(_PIPELINE_DIR))


def _has_module(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def main() -> int:
    if not _FIXTURE.exists():
        print(f"ERROR: golden fixture not found at {_FIXTURE}", file=sys.stderr)
        return 2

    try:
        from verifiers import chemistry, english, maths, physics
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: could not import verifiers: {exc}", file=sys.stderr)
        return 2

    verifiers = {
        "maths": maths.verify,
        "physics": physics.verify,
        "chemistry": chemistry.verify,
        "english": english.verify,
    }

    def languagetool_ready() -> bool:
        try:
            english._get_lt()
            return bool(english._lt_available)
        except Exception:  # noqa: BLE001
            return False

    dep_probes = {
        "pint": lambda: _has_module("pint"),
        "chempy": lambda: _has_module("chempy"),
        "languagetool": languagetool_ready,
    }

    items = json.loads(_FIXTURE.read_text())["items"]

    passed = failed = skipped = 0
    failures: list[str] = []

    print("\n=== Content Pipeline Golden-Set Regression Gate ===\n")
    for item in items:
        item_id = item["id"]
        missing = [
            dep for dep in item.get("requires", [])
            if not dep_probes.get(dep, lambda: True)()
        ]
        if missing:
            skipped += 1
            print(f"  SKIP: {item_id} (needs {', '.join(missing)})")
            continue

        verified, detail = verifiers[item["verifier"]](item["question_data"])
        ok = verified is item["expect_pass"]
        if ok:
            passed += 1
            print(f"  PASS: {item_id}")
        else:
            failed += 1
            direction = "should PASS but was rejected" if item["expect_pass"] \
                else "should be REJECTED but passed"
            msg = f"{item_id} — {direction} — {detail}"
            failures.append(msg)
            print(f"  FAIL: {msg}")

    print(f"\n  {passed} passed, {failed} failed, {skipped} skipped "
          f"(of {len(items)} golden items)\n")

    if failed:
        print("GOLDEN-SET REGRESSION — the deterministic quality gate changed "
              "behaviour:", file=sys.stderr)
        for msg in failures:
            print(f"  - {msg}", file=sys.stderr)
        return 1

    print("Golden set clean — no regression in the deterministic verifiers.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
