"""
Tests for failure_classifier.py — Phase 2A.11 known cases and general patterns.

Run:
    pytest services/content-pipeline/autopilot/tests/test_failure_classifier.py -v
"""

from __future__ import annotations

import sys
from pathlib import Path

_PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_PIPELINE_DIR))

import pytest
from autopilot.failure_classifier import classify, FailureAction


# ── Phase 2A.11 known cases ───────────────────────────────────────────────────

class TestPhase2A11KnownCases:
    """Test fixtures from real failures observed in Phase 2A.11."""

    def test_anthropic_outage_generation_none(self):
        """Anthropic API outage → RETRY_EXTERNAL."""
        c = classify(
            error_message="generation_none: Anthropic returned empty response after 3 retries",
            question_type="english_comprehension",
        )
        assert c.action == FailureAction.RETRY_EXTERNAL
        assert c.confidence >= 0.90

    def test_anthropic_overloaded(self):
        """API overloaded error → RETRY_EXTERNAL."""
        c = classify(
            error_message="AnthropicError: Service overloaded, try again later",
            question_type="maths_arithmetic",
        )
        assert c.action == FailureAction.RETRY_EXTERNAL

    def test_languagetool_false_positive_phonics(self):
        """LT false positive on phonics content → VERIFIER_FALSE_POSITIVE."""
        c = classify(
            error_message="Grammar error in 'correct_answer': Possible spelling mistake",
            question_type="english_phonics",
        )
        assert c.action == FailureAction.VERIFIER_FALSE_POSITIVE
        assert c.confidence >= 0.85

    def test_languagetool_false_positive_punctuation(self):
        """LT style rule on punctuation demonstrations → VERIFIER_FALSE_POSITIVE."""
        c = classify(
            error_message="Grammar error in 'explanation': Colon usage style issue",
            question_type="english_punctuation",
        )
        assert c.action == FailureAction.VERIFIER_FALSE_POSITIVE

    def test_languagetool_false_positive_etymology(self):
        """LT MORFOLOGIK on Latin root words → VERIFIER_FALSE_POSITIVE."""
        c = classify(
            error_message=(
                "Grammar error in 'correct_answer': Possible spelling mistake found by MORFOLOGIK_RULE_EN_GB"
            ),
            question_type="english_etymology",
        )
        assert c.action == FailureAction.VERIFIER_FALSE_POSITIVE

    def test_narrative_writing_score_too_low_rag(self):
        """Narrative writing below threshold due to weak RAG → QUALITY_TOO_LOW."""
        c = classify(
            error_message="score_too_low: confidence 72 below threshold 90 for english_literary_analysis",
            question_type="english_literary_analysis",
        )
        assert c.action == FailureAction.QUALITY_TOO_LOW

    def test_rag_grounding_failure(self):
        """Empty source_chunk_ids → NEEDS_RAG_ENRICHMENT."""
        c = classify(
            error_message="Stage 1 rejected: source_chunk_ids is empty for english_comprehension",
            question_type="english_comprehension",
        )
        assert c.action == FailureAction.NEEDS_RAG_ENRICHMENT

    def test_near_duplicate_rejection(self):
        """Dedup loop → DUPLICATE_OR_LOW_VARIETY."""
        c = classify(
            error_message="Stage 5 dedup: cosine similarity 0.95 exceeds threshold 0.92",
            question_type="maths_arithmetic",
        )
        assert c.action == FailureAction.DUPLICATE_OR_LOW_VARIETY


# ── General pattern tests ─────────────────────────────────────────────────────

class TestGeneralPatterns:
    def test_rate_limit_is_retry_external(self):
        c = classify("429 Too Many Requests from Anthropic API")
        assert c.action == FailureAction.RETRY_EXTERNAL

    def test_connection_reset_is_retry_external(self):
        c = classify("connection reset by peer during generation")
        assert c.action == FailureAction.RETRY_EXTERNAL

    def test_timeout_is_retry_external(self):
        c = classify("timeout: request exceeded 120s limit")
        assert c.action == FailureAction.RETRY_EXTERNAL

    def test_unknown_question_type_is_retry_different_strategy(self):
        c = classify("Unknown question type: 'narrative_free_write' not in allowed list")
        assert c.action == FailureAction.RETRY_WITH_DIFFERENT_STRATEGY

    def test_missing_required_field_is_retry_different_strategy(self):
        c = classify("Missing required field: verification_expression not found in response")
        assert c.action == FailureAction.RETRY_WITH_DIFFERENT_STRATEGY

    def test_json_parse_error_is_retry_different_strategy(self):
        c = classify("JSON parse error: unexpected token at position 42")
        assert c.action == FailureAction.RETRY_WITH_DIFFERENT_STRATEGY

    def test_constitutional_violation_is_quality_too_low(self):
        c = classify("Stage 4 constitutional violation: distractor not plausible enough")
        assert c.action == FailureAction.QUALITY_TOO_LOW

    def test_unsafe_content_is_unsafe(self):
        c = classify("Content policy: response contains inappropriate material")
        assert c.action == FailureAction.UNSAFE_CONTENT

    def test_empty_error_message_is_manual_review(self):
        c = classify("")
        assert c.action == FailureAction.MANUAL_REVIEW_REQUIRED

    def test_completely_unrecognised_error_is_manual_review(self):
        c = classify("xyzzy: frobnication failed in subsystem zork")
        assert c.action == FailureAction.MANUAL_REVIEW_REQUIRED

    def test_max_retries_downgrades_to_manual(self):
        """After max_attempts retries, a normally-retryable error becomes MANUAL_REVIEW."""
        c = classify(
            "anthropic overloaded",
            attempt_count=5,
        )
        assert c.action == FailureAction.MANUAL_REVIEW_REQUIRED
        assert "Max retries exceeded" in c.notes

    def test_max_retries_at_4_still_retries(self):
        """At 4 attempts (below threshold of 5), external errors still retry."""
        c = classify(
            "anthropic overloaded",
            attempt_count=4,
        )
        assert c.action == FailureAction.RETRY_EXTERNAL

    def test_suggested_strategy_is_present(self):
        c = classify("anthropic overloaded")
        assert c.suggested_strategy in ("retry", "blocked", "enrich")

    def test_notes_are_non_empty(self):
        c = classify("any error message")
        assert len(c.notes) > 0


# ── Confidence floor tests ────────────────────────────────────────────────────

class TestConfidence:
    def test_external_error_has_high_confidence(self):
        c = classify("503 service unavailable")
        assert c.confidence >= 0.90

    def test_rag_failure_has_high_confidence(self):
        c = classify("source_chunk_ids empty")
        assert c.confidence >= 0.90

    def test_catch_all_has_low_confidence(self):
        c = classify("")
        assert c.confidence <= 0.35


# ── Regression: score-before-RAG rule ordering ────────────────────────────────

class TestScoreBeforeRAGOrdering:
    """
    The pipeline emits "Stage 6: score=XX below threshold or RAG grounding failed"
    for ANY stage-6 failure. This message matches both the QUALITY_TOO_LOW rule
    (score present) and the NEEDS_RAG_ENRICHMENT rule (rag grounding phrase).
    The QUALITY_TOO_LOW rule must fire first because a score number in the
    message is strong evidence the topic was attempted and scored low — not that
    chunks are missing (topics that actually lack chunks never reach Stage 6).
    """

    _PIPELINE_MSG = "Stage 6: score={score} below threshold or RAG grounding failed"

    def test_score_65_routes_to_quality_not_rag(self):
        """The canonical pipeline Stage 6 message → QUALITY_TOO_LOW, not NEEDS_RAG_ENRICHMENT."""
        c = classify(self._PIPELINE_MSG.format(score=65.0))
        assert c.action == FailureAction.QUALITY_TOO_LOW, (
            f"Expected QUALITY_TOO_LOW but got {c.action}. "
            "Likely rule-order regression: RAG rule fired before QUALITY rule."
        )

    def test_score_70_routes_to_quality_not_rag(self):
        c = classify(self._PIPELINE_MSG.format(score=70))
        assert c.action == FailureAction.QUALITY_TOO_LOW

    def test_score_80_routes_to_quality_not_rag(self):
        c = classify(self._PIPELINE_MSG.format(score=80))
        assert c.action == FailureAction.QUALITY_TOO_LOW

    def test_bare_rag_grounding_still_routes_to_rag(self):
        """A message with only 'RAG grounding failed' (no score) → NEEDS_RAG_ENRICHMENT."""
        c = classify("Stage 1: RAG grounding failed — source_chunk_ids empty")
        assert c.action == FailureAction.NEEDS_RAG_ENRICHMENT

    def test_source_chunk_ids_empty_routes_to_rag(self):
        c = classify("source_chunk_ids is empty for topic y7-english-literature-character")
        assert c.action == FailureAction.NEEDS_RAG_ENRICHMENT
