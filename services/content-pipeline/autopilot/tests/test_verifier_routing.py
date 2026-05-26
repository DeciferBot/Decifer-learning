"""
Tests for verifier_router.py — proving each question type routes correctly.

Covers:
  1.  english_grammar routes to ENGLISH_GRAMMAR with LT standard mode
  2.  english_phonics routes to ENGLISH_PHONICS with LT skipped
  3.  english_punctuation routes to ENGLISH_PUNCTUATION with LT style_relaxed
  4.  english_etymology routes to ENGLISH_ETYMOLOGY with LT spelling_suppressed
  5.  english_comprehension routes to ENGLISH_RAG_ONLY
  6.  maths_arithmetic routes to MATHS_ARITHMETIC with LT skipped
  7.  Phonics misclassified as grammar is caught and re-routed to ENGLISH_PHONICS
  8.  Unknown type routes to UNKNOWN

Integration tests (require LanguageTool installed):
  - Normal grammar question with a real error is NOT blocked
  - Phonics question with phoneme content is NOT blocked
  - Punctuation demo question with colon usage is NOT blocked
  - Etymology question with Latin root is NOT blocked

Run:
    pytest services/content-pipeline/autopilot/tests/test_verifier_routing.py -v
    # Integration tests (slower, requires LT):
    pytest services/content-pipeline/autopilot/tests/test_verifier_routing.py -v -m integration
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow imports from services/content-pipeline/
_PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_PIPELINE_DIR))

import pytest
from autopilot.verifier_router import route, VerifierPath


# ── Unit tests — routing decisions (no LT needed) ────────────────────────────

class TestEnglishRouting:
    def test_grammar_routes_to_lt_standard(self):
        q = {"question_type": "english_grammar", "question_metadata": {}}
        d = route(q)
        assert d.path == VerifierPath.ENGLISH_GRAMMAR
        assert d.uses_language_tool is True
        assert d.language_tool_mode == "standard"

    def test_spelling_routes_to_lt_spelling_suppressed(self):
        q = {"question_type": "english_spelling", "question_metadata": {}}
        d = route(q)
        assert d.path == VerifierPath.ENGLISH_SPELLING
        assert d.uses_language_tool is True
        assert d.language_tool_mode == "spelling_suppressed"

    def test_phonics_routes_to_phonics_safe(self):
        q = {"question_type": "english_phonics", "question_metadata": {}}
        d = route(q)
        assert d.path == VerifierPath.ENGLISH_PHONICS
        assert d.uses_language_tool is False
        assert d.language_tool_mode == "skipped"

    def test_punctuation_routes_to_style_relaxed(self):
        q = {"question_type": "english_punctuation", "question_metadata": {}}
        d = route(q)
        assert d.path == VerifierPath.ENGLISH_PUNCTUATION
        assert d.uses_language_tool is True
        assert d.language_tool_mode == "style_relaxed"

    def test_etymology_routes_to_spelling_suppressed(self):
        q = {"question_type": "english_etymology", "question_metadata": {}}
        d = route(q)
        assert d.path == VerifierPath.ENGLISH_ETYMOLOGY
        assert d.uses_language_tool is True
        assert d.language_tool_mode == "spelling_suppressed"

    def test_comprehension_routes_to_rag_only(self):
        q = {"question_type": "english_comprehension"}
        d = route(q)
        assert d.path == VerifierPath.ENGLISH_RAG_ONLY
        assert d.language_tool_mode == "prose_only"

    def test_vocabulary_routes_to_rag_only(self):
        q = {"question_type": "english_vocabulary"}
        d = route(q)
        assert d.path == VerifierPath.ENGLISH_RAG_ONLY

    def test_literary_analysis_routes_to_rag_only(self):
        q = {"question_type": "english_literary_analysis"}
        d = route(q)
        assert d.path == VerifierPath.ENGLISH_RAG_ONLY

    def test_phonics_misclassified_as_grammar_is_rerouted(self):
        """A grammar question whose intentional_error_type is phonics should re-route."""
        q = {
            "question_type": "english_grammar",
            "question_metadata": {"intentional_error_type": "digraph_confusion"},
        }
        d = route(q)
        assert d.path == VerifierPath.ENGLISH_PHONICS
        assert d.uses_language_tool is False
        assert "phonics" in d.notes.lower()

    def test_etymology_misclassified_as_spelling_is_rerouted(self):
        q = {
            "question_type": "english_spelling",
            "question_metadata": {"intentional_error_type": "latin root word"},
        }
        d = route(q)
        assert d.path == VerifierPath.ENGLISH_ETYMOLOGY
        assert d.language_tool_mode == "spelling_suppressed"

    def test_unknown_english_type_routes_to_unknown(self):
        q = {"question_type": "english_narrative_fiction"}
        d = route(q)
        assert d.path == VerifierPath.UNKNOWN


class TestMathsRouting:
    def test_arithmetic_routes_correctly(self):
        q = {"question_type": "maths_arithmetic"}
        d = route(q)
        assert d.path == VerifierPath.MATHS_ARITHMETIC
        assert d.uses_language_tool is False

    def test_algebra_routes_correctly(self):
        q = {"question_type": "maths_algebra"}
        d = route(q)
        assert d.path == VerifierPath.MATHS_ALGEBRA

    def test_unknown_maths_type_routes_to_general(self):
        q = {"question_type": "maths_data_handling"}
        d = route(q)
        assert d.path == VerifierPath.MATHS_GENERAL


class TestScienceRouting:
    def test_physics_calculation_routes_correctly(self):
        q = {"question_type": "science_physics_calculation"}
        d = route(q)
        assert d.path == VerifierPath.PHYSICS_CALCULATION

    def test_chemistry_equation_routes_correctly(self):
        q = {"question_type": "science_chemistry_equation"}
        d = route(q)
        assert d.path == VerifierPath.CHEMISTRY_EQUATION

    def test_chemistry_element_fact_routes_correctly(self):
        q = {"question_type": "chemistry_element_fact"}
        d = route(q)
        assert d.path == VerifierPath.CHEMISTRY_ELEMENT


class TestUnknownRouting:
    def test_empty_type_routes_to_unknown(self):
        d = route({})
        assert d.path == VerifierPath.UNKNOWN

    def test_completely_unknown_prefix_routes_to_unknown(self):
        q = {"question_type": "art_history_periods"}
        d = route(q)
        assert d.path == VerifierPath.UNKNOWN


# ── Integration tests — actual verifier calls (LT must be installed) ─────────

@pytest.mark.integration
class TestVerifierIntegration:
    """These tests require the english verifier and LanguageTool to be available."""

    def _verify_english(self, question_data: dict):
        from verifiers.english import verify
        return verify(question_data)

    def test_grammar_with_real_error_uses_lt_path(self):
        """A valid grammar question with a stimulus error should pass LT verification."""
        q = {
            "question_type": "english_grammar",
            "question_text": "Find and correct the grammar error.",
            "correct_answer": "She went to the shop.",
            "explanation": "The verb tense was incorrect.",
            "hint_1": "Look at the verb carefully.",
            "hint_2": "What tense should this sentence be in?",
            "hint_3": "Change the verb to past tense.",
            "question_metadata": {
                "instruction_text": "Find and correct the grammar error in the sentence below.",
                "stimulus_text": "She go to the shop yesterday.",
                "intentional_error_type": "wrong_verb_tense",
                "intentional_error_span": {"start": 4, "end": 6},
            },
        }
        ok, detail = self._verify_english(q)
        assert ok, f"Valid grammar question should pass: {detail}"
        # Confirm it went through the LT path (not falsely short-circuited)
        routing = route(q)
        assert routing.uses_language_tool is True

    def test_phonics_not_falsely_blocked(self):
        """A phonics question with phoneme content should pass without LT false positives."""
        q = {
            "question_type": "english_phonics",
            "question_text": "Which digraph makes the /ʃ/ sound?",
            "correct_answer": "sh",
            "explanation": "The digraph sh makes the /ʃ/ sound as in ship and fish.",
            "hint_1": "Listen for the sound at the start of ship.",
            "hint_2": "It is made of two letters that work together.",
            "hint_3": "The two letters are s and h.",
            "distractors": ["ch", "th", "wh"],
            "source_chunk_ids": [],
            "question_metadata": {
                "instruction_text": "Which two letters together make the sound in ship?",
                "stimulus_text": "sh",
                "intentional_error_type": None,
            },
        }
        ok, detail = self._verify_english(q)
        assert ok, f"Phonics question with phoneme content should not be blocked: {detail}"

    def test_punctuation_demo_not_falsely_blocked(self):
        """A punctuation demonstration question should not be blocked by LT style rules."""
        q = {
            "question_type": "english_punctuation",
            "question_text": "What punctuation mark is used before a list?",
            "correct_answer": "colon",
            "explanation": "A colon introduces a list. For example: apples, oranges, and bananas.",
            "hint_1": "This punctuation mark looks like two dots stacked vertically.",
            "hint_2": "It appears before listing items.",
            "hint_3": "The mark is a colon (:).",
            "distractors": ["comma", "semicolon", "full stop"],
            "question_metadata": {
                "instruction_text": "What punctuation mark belongs in the gap?",
                "stimulus_text": "We need three things_ flour, eggs, and butter.",
                "intentional_error_type": "missing_colon",
            },
        }
        ok, detail = self._verify_english(q)
        assert ok, f"Punctuation demo question should not be blocked: {detail}"

    def test_etymology_not_falsely_blocked(self):
        """An etymology question with Latin roots should not be blocked by MORFOLOGIK."""
        q = {
            "question_type": "english_etymology",
            "question_text": "What does the Latin root 'aqua' mean?",
            "correct_answer": "water",
            "explanation": "The Latin root 'aqua' means water. "
                           "It appears in words like aquarium, aquatic, and aqueduct.",
            "hint_1": "Think about what an aquarium contains.",
            "hint_2": "The root comes from Latin and relates to a liquid.",
            "hint_3": "Aqua means water.",
            "distractors": ["fire", "earth", "air"],
            "source_chunk_ids": ["chunk-1"],
        }
        ok, detail = self._verify_english(q)
        assert ok, f"Etymology question with Latin roots should not be blocked: {detail}"
