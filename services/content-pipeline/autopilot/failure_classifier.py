"""
failure_classifier.py — Deterministic error → action classifier for the autopilot.

Maps a generation failure (error_message + context) into an action category that
drives the next step for the failed job.

Action categories:
    RETRY_EXTERNAL                 — transient: API outage, rate limit, timeout
    RETRY_WITH_DIFFERENT_STRATEGY  — structural: wrong question type, prompt issue
    NEEDS_RAG_ENRICHMENT           — factual: no RAG chunks or empty source_chunk_ids
    VERIFIER_FALSE_POSITIVE        — LT / verifier flagged valid content incorrectly
    QUALITY_TOO_LOW                — score below threshold, constitutional violations
    DUPLICATE_OR_LOW_VARIETY       — near-duplicate / dedup loop
    UNSAFE_CONTENT                 — content policy violation (should be rare)
    MANUAL_REVIEW_REQUIRED         — cannot classify; human must inspect

Each rule is a (pattern, context_test, action, confidence, notes) tuple.
Rules are evaluated in order; first match wins.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class FailureAction(str, Enum):
    RETRY_EXTERNAL                = "RETRY_EXTERNAL"
    RETRY_WITH_DIFFERENT_STRATEGY = "RETRY_WITH_DIFFERENT_STRATEGY"
    NEEDS_RAG_ENRICHMENT          = "NEEDS_RAG_ENRICHMENT"
    VERIFIER_FALSE_POSITIVE       = "VERIFIER_FALSE_POSITIVE"
    QUALITY_TOO_LOW               = "QUALITY_TOO_LOW"
    DUPLICATE_OR_LOW_VARIETY      = "DUPLICATE_OR_LOW_VARIETY"
    UNSAFE_CONTENT                = "UNSAFE_CONTENT"
    MANUAL_REVIEW_REQUIRED        = "MANUAL_REVIEW_REQUIRED"


@dataclass(frozen=True)
class Classification:
    action: FailureAction
    confidence: float           # 0.0–1.0
    suggested_strategy: str     # e.g. "topup", "retry", "enrich"
    notes: str


# ── Rules ─────────────────────────────────────────────────────────────────────
#
# Each entry: (error_pattern, question_type_pattern, action, confidence, strategy, notes)
# Both patterns are case-insensitive regex. Use "" to match anything.

_RULES: list[tuple[str, str, FailureAction, float, str, str]] = [
    # ── External / transient API failures ────────────────────────────────────
    (
        r"overloaded|rate.limit|too many requests|429|503|502|gateway|timeout"
        r"|connection.*reset|anthropic.*error|generation_none|empty.*response"
        r"|no.*json.*returned|litellm.*error",
        r"",
        FailureAction.RETRY_EXTERNAL,
        0.95,
        "retry",
        "Transient Anthropic / network error. Safe to retry after back-off.",
    ),

    # ── LanguageTool false positives — phonics / digraph ─────────────────────
    (
        r"grammar error|language.?tool|lt.error|rule_id.*MORFOLOGIK"
        r"|unexpected.*grammar|prose.*error",
        r"english_phonics|phonics|digraph|phoneme|blend|trigraph",
        FailureAction.VERIFIER_FALSE_POSITIVE,
        0.90,
        "retry",
        "LT false positive on phoneme sequences. Route question to phonics-safe verifier.",
    ),

    # ── LanguageTool false positives — punctuation demonstrations ────────────
    (
        r"grammar error|language.?tool|lt.error|prose.*error|style.*issue",
        r"english_punctuation|punctuation.*demo|colon.*usage|semicolon",
        FailureAction.VERIFIER_FALSE_POSITIVE,
        0.90,
        "retry",
        "LT style-rule false positive on punctuation example. "
        "Route to punctuation-aware verifier.",
    ),

    # ── LanguageTool false positives — etymology ─────────────────────────────
    (
        r"grammar error|language.?tool|spelling.*mistake|morfologik"
        r"|possible spelling",
        r"english_etymology|etymology|latin.*origin|greek.*root|word.*origin",
        FailureAction.VERIFIER_FALSE_POSITIVE,
        0.90,
        "retry",
        "LT MORFOLOGIK false positive on Latin/Greek root words. "
        "Route to etymology-safe verifier.",
    ),

    # ── General LT false positive (any English type, low stage) ──────────────
    (
        r"grammar error in .*(hint|explanation|correct_answer)"
        r"|prose.*fields.*clean.*failed",
        r"english_",
        FailureAction.VERIFIER_FALSE_POSITIVE,
        0.75,
        "retry",
        "Possible LT false positive in prose field. Check question_type routing.",
    ),

    # ── RAG grounding failures ────────────────────────────────────────────────
    (
        r"source_chunk_ids.*empty|source_chunk_ids.*null|rag.*grounding"
        r"|no.*chunks.*found|grounding.*required|chunk.*not.*found"
        r"|empty.*source_chunk",
        r"",
        FailureAction.NEEDS_RAG_ENRICHMENT,
        0.92,
        "enrich",
        "source_chunk_ids is empty. Seed more curriculum_chunks for this "
        "subject+year_group before retrying.",
    ),

    # ── Score / quality too low ───────────────────────────────────────────────
    (
        r"score_too_low|confidence.*below|threshold.*not.*met"
        r"|score.*[0-9]+.*below|quality.*score|constitutional.*violation"
        r"|narrative.*score|literary.*score",
        r"",
        FailureAction.QUALITY_TOO_LOW,
        0.85,
        "retry",
        "Confidence score below publish threshold. "
        "May improve with better RAG grounding or a different generation strategy.",
    ),

    # ── Near-duplicate / dedup loop ───────────────────────────────────────────
    (
        r"dedup|similarity.*0\.[89]|near.duplicate|cosine.*similarity"
        r"|already.*exists|low.*variety|dedup.*reject",
        r"",
        FailureAction.DUPLICATE_OR_LOW_VARIETY,
        0.88,
        "retry",
        "Question rejected by semantic deduplication. "
        "Pool may be exhausted; try a diversity-boosted prompt strategy.",
    ),

    # ── Unknown / unsupported question type ───────────────────────────────────
    (
        r"unknown.*question.*type|question_type.*not.*supported"
        r"|unsupported.*type|unknown.*type",
        r"",
        FailureAction.RETRY_WITH_DIFFERENT_STRATEGY,
        0.85,
        "retry",
        "Pipeline rejected the question_type. LLM may have generated a type "
        "outside the allowed list. Use a tighter generation prompt.",
    ),

    # ── Structural / format failures ──────────────────────────────────────────
    (
        r"missing.*field|json.*invalid|parse.*error|required.*field"
        r"|validation.*error|schema.*error|KeyError|AttributeError",
        r"",
        FailureAction.RETRY_WITH_DIFFERENT_STRATEGY,
        0.80,
        "retry",
        "Malformed LLM output. Retry with stricter JSON schema prompting.",
    ),

    # ── Unsafe content (should be rare in practice) ───────────────────────────
    (
        r"unsafe|inappropriate|harmful|violent|sexual|discriminat",
        r"",
        FailureAction.UNSAFE_CONTENT,
        0.95,
        "blocked",
        "Content flagged as unsafe. Do not retry automatically.",
    ),

    # ── Catch-all ─────────────────────────────────────────────────────────────
    (
        r"",
        r"",
        FailureAction.MANUAL_REVIEW_REQUIRED,
        0.30,
        "blocked",
        "Cannot classify error automatically. Inspect generation_errors table.",
    ),
]


# ── Public API ────────────────────────────────────────────────────────────────

def classify(
    error_message: str,
    question_type: Optional[str] = None,
    stage_failed: Optional[int] = None,
    attempt_count: int = 0,
) -> Classification:
    """Classify a generation failure into an action category.

    Args:
        error_message:  The error_message from generation_errors or pipeline log.
        question_type:  The question_type of the failing question (if known).
        stage_failed:   Pipeline stage number (1-6) where the failure occurred.
        attempt_count:  How many times this job has already been retried.

    Returns:
        Classification with action, confidence, suggested_strategy, notes.
    """
    msg   = (error_message or "").lower()
    qtype = (question_type or "").lower()

    for err_pat, type_pat, action, confidence, strategy, notes in _RULES:
        err_match  = re.search(err_pat, msg,   re.IGNORECASE) if err_pat  else True
        type_match = re.search(type_pat, qtype, re.IGNORECASE) if type_pat else True

        if err_match and type_match:
            # Downgrade to MANUAL_REVIEW if too many retries
            if attempt_count >= 5 and action in (
                FailureAction.RETRY_EXTERNAL,
                FailureAction.RETRY_WITH_DIFFERENT_STRATEGY,
                FailureAction.QUALITY_TOO_LOW,
                FailureAction.DUPLICATE_OR_LOW_VARIETY,
            ):
                return Classification(
                    action=FailureAction.MANUAL_REVIEW_REQUIRED,
                    confidence=0.95,
                    suggested_strategy="blocked",
                    notes=f"Max retries exceeded. Original classification: {action.value}. {notes}",
                )
            return Classification(
                action=action,
                confidence=confidence,
                suggested_strategy=strategy,
                notes=notes,
            )

    # Should never reach here due to catch-all rule
    return Classification(
        action=FailureAction.MANUAL_REVIEW_REQUIRED,
        confidence=0.20,
        suggested_strategy="blocked",
        notes="Classifier reached end of rules without a match.",
    )


def classify_batch(errors: list[dict]) -> list[dict]:
    """Classify a batch of error dicts from the generation_errors table.

    Each input dict should have: error_message, question_type, stage_failed.
    Returns list of dicts with original fields + classification fields added.
    """
    results = []
    for err in errors:
        c = classify(
            error_message=err.get("error_message", ""),
            question_type=err.get("question_type"),
            stage_failed=err.get("stage_failed"),
        )
        results.append({
            **err,
            "classified_action": c.action.value,
            "classified_confidence": c.confidence,
            "suggested_strategy": c.suggested_strategy,
            "classifier_notes": c.notes,
        })
    return results
