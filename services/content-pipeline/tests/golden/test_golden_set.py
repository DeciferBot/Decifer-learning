"""
Golden-set regression test for the Stage-2 deterministic verifiers.

A "golden set" is a FIXED bank of known-good and known-bad content items
(``golden_items.json``). Every GOOD item MUST verify true and every BAD item
MUST be rejected — so a prompt or model change can never silently degrade the
quality gate. These tests are pure, offline and deterministic: they call the
verifier modules directly with no Anthropic / OpenAI / network access.

Each item is parametrised into its own test case so a single regression is
pinpointed by id (e.g. ``test_golden_item[math-arith-bad-2plus2eq5]``).

Items may declare ``requires`` (e.g. ``pint``, ``chempy``, ``languagetool``).
If that runtime dependency is not installed the case is SKIPPED — never failed —
matching how the existing english verifier suite degrades gracefully when
LanguageTool is unavailable.

Run:
    pytest services/content-pipeline/tests/golden/test_golden_set.py -v
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Allow imports from services/content-pipeline/ (verifiers package lives there).
_PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_PIPELINE_DIR))

from verifiers import chemistry, english, maths, physics  # noqa: E402

_FIXTURE = Path(__file__).resolve().parent / "golden_items.json"

_VERIFIERS = {
    "maths": maths.verify,
    "physics": physics.verify,
    "chemistry": chemistry.verify,
    "english": english.verify,
}


# ── Dependency probes (skip, never fail, when a verifier dep is missing) ──────

def _has_module(name: str) -> bool:
    import importlib.util

    return importlib.util.find_spec(name) is not None


def _languagetool_ready() -> bool:
    """True only if LanguageTool can actually be instantiated.

    The english verifier degrades to a graceful pass when LanguageTool is
    unavailable, which would let a BAD grammar item slip through. So we only
    run languagetool-dependent golden cases when the daemon is genuinely up.
    """
    try:
        english._get_lt()  # initialise so _lt_available reflects current state
        return bool(english._lt_available)
    except Exception:
        return False


_DEP_PROBES = {
    "pint": lambda: _has_module("pint"),
    "chempy": lambda: _has_module("chempy"),
    "languagetool": _languagetool_ready,
}


def _missing_deps(requires: list[str]) -> list[str]:
    return [dep for dep in requires if not _DEP_PROBES.get(dep, lambda: True)()]


# ── Fixture loading ──────────────────────────────────────────────────────────

def _load_items() -> list[dict]:
    data = json.loads(_FIXTURE.read_text())
    items = data["items"]
    assert items, "golden_items.json contains no items"
    ids = [it["id"] for it in items]
    assert len(ids) == len(set(ids)), "duplicate golden item ids found"
    return items


_ITEMS = _load_items()


# ── The regression test ──────────────────────────────────────────────────────

@pytest.mark.parametrize("item", _ITEMS, ids=[it["id"] for it in _ITEMS])
def test_golden_item(item: dict) -> None:
    requires = item.get("requires", [])
    missing = _missing_deps(requires)
    if missing:
        pytest.skip(f"requires unavailable dependency: {', '.join(missing)}")

    verify = _VERIFIERS[item["verifier"]]
    verified, detail = verify(item["question_data"])

    expect = item["expect_pass"]
    if expect:
        assert verified is True, (
            f"GOLDEN REGRESSION: good item {item['id']!r} should verify True "
            f"but was rejected — {detail}"
        )
    else:
        assert verified is False, (
            f"GOLDEN REGRESSION: bad item {item['id']!r} should be rejected "
            f"but verified True — {detail}"
        )


def test_golden_set_has_good_and_bad_per_verifier() -> None:
    """Sanity: each verifier has at least one good AND one bad golden item,
    so the bank actually exercises both directions of every gate."""
    by_verifier: dict[str, set[bool]] = {}
    for it in _ITEMS:
        by_verifier.setdefault(it["verifier"], set()).add(it["expect_pass"])
    for verifier, outcomes in by_verifier.items():
        assert True in outcomes, f"{verifier}: no GOOD golden item"
        assert False in outcomes, f"{verifier}: no BAD golden item"
