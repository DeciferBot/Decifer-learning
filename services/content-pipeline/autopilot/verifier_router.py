"""
verifier_router.py — Question-type → verifier-path routing for the autopilot.

This module decides which verification path a question should take in Stage 2
of the pipeline, based on question_type and question_metadata.

Rules:
    english_grammar          → LanguageTool (standard)
    english_spelling         → LanguageTool (spelling suppressed on prose fields)
    english_phonics          → phonics-safe verifier (LT skipped on phoneme content)
    english_punctuation      → punctuation-aware verifier (LT style rules relaxed)
    english_etymology        → etymology-safe verifier (LT MORFOLOGIK suppressed)
    english_comprehension    → RAG-only (LT on prose fields only)
    english_vocabulary       → RAG-only
    english_literary_analysis→ RAG-only
    maths_*                  → maths verifier (SymPy / safe-eval)
    science_physics_*        → physics verifier (Pint + SymPy)
    science_chemistry_*      → chemistry verifier (ChemPy)
    chemistry_element_fact   → chemistry verifier (periodic table lookup)

The router does NOT call the verifiers — it returns routing metadata.
Actual verification is performed by pipeline.py using english.verify(),
maths.verify(), etc.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class VerifierPath(str, Enum):
    # English
    ENGLISH_GRAMMAR      = "english_grammar"
    ENGLISH_SPELLING     = "english_spelling"
    ENGLISH_PHONICS      = "english_phonics"
    ENGLISH_PUNCTUATION  = "english_punctuation"
    ENGLISH_ETYMOLOGY    = "english_etymology"
    ENGLISH_RAG_ONLY     = "english_rag_only"
    # Maths
    MATHS_ARITHMETIC     = "maths_arithmetic"
    MATHS_ALGEBRA        = "maths_algebra"
    MATHS_GEOMETRY       = "maths_geometry"
    MATHS_GENERAL        = "maths_general"
    # Science
    PHYSICS_CALCULATION  = "physics_calculation"
    CHEMISTRY_EQUATION   = "chemistry_equation"
    CHEMISTRY_ELEMENT    = "chemistry_element"
    SCIENCE_FACTUAL      = "science_factual"
    # Unknown
    UNKNOWN              = "unknown"


@dataclass(frozen=True)
class RoutingDecision:
    path: VerifierPath
    uses_language_tool: bool
    language_tool_mode: str     # "standard" | "spelling_suppressed" | "skipped" | "prose_only"
    notes: str


# ── English routing rules ─────────────────────────────────────────────────────
#
# Ordered: more specific checks first; catch-all last.

def _route_english(question_data: dict) -> RoutingDecision:
    qtype    = (question_data.get("question_type") or "").lower()
    metadata = question_data.get("question_metadata") or {}

    # Explicit phonics type
    if qtype == "english_phonics":
        return RoutingDecision(
            path=VerifierPath.ENGLISH_PHONICS,
            uses_language_tool=False,
            language_tool_mode="skipped",
            notes="Phoneme sequences and digraph symbols are not English words; "
                  "LT is skipped on phoneme content to prevent false positives.",
        )

    # Explicit etymology type
    if qtype == "english_etymology":
        return RoutingDecision(
            path=VerifierPath.ENGLISH_ETYMOLOGY,
            uses_language_tool=True,
            language_tool_mode="spelling_suppressed",
            notes="MORFOLOGIK spelling rules suppressed for Latin/Greek root words. "
                  "Grammar and punctuation rules still apply.",
        )

    # Explicit punctuation type
    if qtype == "english_punctuation":
        return RoutingDecision(
            path=VerifierPath.ENGLISH_PUNCTUATION,
            uses_language_tool=True,
            language_tool_mode="style_relaxed",
            notes="LT style rules relaxed for punctuation demonstration questions. "
                  "Intentional colon/semicolon/dash usage is not a grammar error.",
        )

    # Grammar / spelling — detect phonics-like questions misclassified as grammar
    if qtype in ("english_grammar", "english_spelling"):
        error_type = (metadata.get("intentional_error_type") or "").lower()
        phonics_keywords = ("phoneme", "digraph", "phonics", "blend", "trigraph", "grapheme")
        if any(kw in error_type for kw in phonics_keywords):
            return RoutingDecision(
                path=VerifierPath.ENGLISH_PHONICS,
                uses_language_tool=False,
                language_tool_mode="skipped",
                notes=f"question_type is {qtype!r} but intentional_error_type={error_type!r} "
                      "suggests phonics content. Routed to phonics-safe verifier.",
            )
        # Detect etymology-like questions misclassified as spelling
        if qtype == "english_spelling" and any(
            kw in (metadata.get("intentional_error_type") or "").lower()
            for kw in ("latin", "greek", "etymology", "word origin", "root word")
        ):
            return RoutingDecision(
                path=VerifierPath.ENGLISH_ETYMOLOGY,
                uses_language_tool=True,
                language_tool_mode="spelling_suppressed",
                notes="Spelling question references etymology. "
                      "MORFOLOGIK suppressed to avoid false positives on root words.",
            )
        mode = "spelling_suppressed" if qtype == "english_spelling" else "standard"
        return RoutingDecision(
            path=VerifierPath.ENGLISH_GRAMMAR if qtype == "english_grammar"
                 else VerifierPath.ENGLISH_SPELLING,
            uses_language_tool=True,
            language_tool_mode=mode,
            notes="Standard LT path for grammar/spelling intentional-error questions.",
        )

    # RAG-only types
    if qtype in ("english_comprehension", "english_vocabulary", "english_literary_analysis"):
        return RoutingDecision(
            path=VerifierPath.ENGLISH_RAG_ONLY,
            uses_language_tool=True,
            language_tool_mode="prose_only",
            notes="Stage 2 checks prose field grammar only; "
                  "factual grounding handled in Stage 6.",
        )

    return RoutingDecision(
        path=VerifierPath.UNKNOWN,
        uses_language_tool=False,
        language_tool_mode="skipped",
        notes=f"Unrecognised English question type: {qtype!r}. Will fail verification.",
    )


# ── Maths routing ─────────────────────────────────────────────────────────────

def _route_maths(question_data: dict) -> RoutingDecision:
    qtype = (question_data.get("question_type") or "").lower()
    path_map = {
        "maths_arithmetic": VerifierPath.MATHS_ARITHMETIC,
        "maths_algebra":    VerifierPath.MATHS_ALGEBRA,
        "maths_geometry":   VerifierPath.MATHS_GEOMETRY,
    }
    path = path_map.get(qtype, VerifierPath.MATHS_GENERAL)
    return RoutingDecision(
        path=path,
        uses_language_tool=False,
        language_tool_mode="skipped",
        notes="Maths question: SymPy / safe-eval verification; LT not applicable.",
    )


# ── Science routing ───────────────────────────────────────────────────────────

def _route_science(question_data: dict) -> RoutingDecision:
    qtype = (question_data.get("question_type") or "").lower()
    if "physics" in qtype or "calculation" in qtype:
        return RoutingDecision(
            path=VerifierPath.PHYSICS_CALCULATION,
            uses_language_tool=False,
            language_tool_mode="skipped",
            notes="Physics calculation: Pint + SymPy verification.",
        )
    if "chemistry_equation" in qtype:
        return RoutingDecision(
            path=VerifierPath.CHEMISTRY_EQUATION,
            uses_language_tool=False,
            language_tool_mode="skipped",
            notes="Chemistry equation: ChemPy verification.",
        )
    if "chemistry_element" in qtype or "element_fact" in qtype:
        return RoutingDecision(
            path=VerifierPath.CHEMISTRY_ELEMENT,
            uses_language_tool=False,
            language_tool_mode="skipped",
            notes="Element fact: local periodic-table lookup.",
        )
    return RoutingDecision(
        path=VerifierPath.SCIENCE_FACTUAL,
        uses_language_tool=False,
        language_tool_mode="skipped",
        notes="Open factual science: no code verifier; higher Stage-6 threshold applies.",
    )


# ── Public API ────────────────────────────────────────────────────────────────

def route(question_data: dict) -> RoutingDecision:
    """Return the appropriate RoutingDecision for a question.

    This is the single entry point for the routing layer. Callers
    can inspect the returned path to decide which verifier module to invoke.
    """
    qtype = (question_data.get("question_type") or "").lower()

    if qtype.startswith("english_"):
        return _route_english(question_data)

    if qtype.startswith("maths_"):
        return _route_maths(question_data)

    if qtype.startswith("science_") or qtype.startswith("chemistry_"):
        return _route_science(question_data)

    return RoutingDecision(
        path=VerifierPath.UNKNOWN,
        uses_language_tool=False,
        language_tool_mode="skipped",
        notes=f"Unknown question_type prefix: {qtype!r}.",
    )
