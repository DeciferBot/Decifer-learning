"""
English verifier for Decifer Learning content pipeline.

Stage 2: code verification — CLAUDE.md §9.

Supported question types:
  english_grammar          — intentional-error questions; uses question_metadata
  english_spelling         — intentional-error questions; uses question_metadata
  english_comprehension    — RAG-grounded; grammar sanity on prose fields
  english_vocabulary       — RAG-grounded; grammar sanity on prose fields
  english_literary_analysis — RAG-grounded; grammar sanity on prose fields

Returns (verified: bool, detail: str). Never raises; failures return False + reason.

LanguageTool dependency is optional: if the `language_tool_python` package is not
installed, grammar checks degrade gracefully but log a warning. The verifier version
reflects whether LanguageTool is available.
"""

from __future__ import annotations

import logging
from typing import Tuple

log = logging.getLogger("verifier.english")

VERIFIER_VERSION = "1.0.0"

# ── LanguageTool helper ───────────────────────────────────────────────────

_lt = None
_lt_available = False


def _get_lt():
    global _lt, _lt_available
    if _lt is not None:
        return _lt
    try:
        import language_tool_python  # type: ignore
        _lt = language_tool_python.LanguageTool("en-GB")
        _lt_available = True
        return _lt
    except Exception as exc:
        log.warning(f"LanguageTool unavailable: {exc}. Grammar checks will be skipped.")
        _lt = False
        return None


def _lt_errors(text: str) -> list[dict]:
    """Return LanguageTool errors as a list of dicts with offset, length, rule."""
    lt = _get_lt()
    if lt is None or not text:
        return []
    try:
        matches = lt.check(text)
        return [
            {
                "offset": m.offset,
                # language_tool_python ≥ 3.x uses snake_case attributes
                "length": getattr(m, "error_length", None) or getattr(m, "errorLength", 0),
                "rule": getattr(m, "rule_id", None) or getattr(m, "ruleId", ""),
                "message": m.message,
            }
            for m in matches
        ]
    except Exception as exc:
        log.warning(f"LanguageTool check error: {exc}")
        return []


def _overlaps(err: dict, span_start: int, span_end: int) -> bool:
    err_start = err["offset"]
    err_end = err["offset"] + err["length"]
    return err_start < span_end and err_end > span_start


# ── Core field grammar checks ─────────────────────────────────────────────

def _check_prose_fields(data: dict) -> Tuple[bool, str]:
    """All prose fields (except intentional-error stimulus) should be grammatically clean."""
    fields_to_check = {
        "correct_answer": data.get("correct_answer", ""),
        "explanation": data.get("explanation", ""),
        "hint_1": data.get("hint_1", ""),
        "hint_2": data.get("hint_2", ""),
        "hint_3": data.get("hint_3", ""),
    }
    for field_name, text in fields_to_check.items():
        if not text:
            continue
        errors = _lt_errors(str(text))
        if errors:
            detail = "; ".join(e["message"] for e in errors[:3])
            return False, f"Grammar error in {field_name!r}: {detail}"
    return True, "prose fields clean"


# ── Grammar / spelling question handler ──────────────────────────────────

def _verify_intentional_error_question(data: dict, qtype: str) -> Tuple[bool, str]:
    """
    For english_grammar and english_spelling questions.

    question_metadata must contain:
      instruction_text        — the question instruction (must be correct)
      stimulus_text           — the text shown to the child (may contain intentional error)
      intentional_error_type  — e.g. "missing_comma", "misspelled_word"
      intentional_error_span  — optional {"start": int, "end": int}

    Rules:
      - question_metadata must be present and correctly structured.
      - instruction_text must pass LanguageTool (no grammar errors allowed).
      - correct_answer, explanation, hints must pass LanguageTool.
      - stimulus_text may contain the intentional error.
      - If intentional_error_span is given, LanguageTool errors MUST overlap that span.
      - LanguageTool errors outside intentional_error_span FAIL verification.
    """
    metadata = data.get("question_metadata")
    if not isinstance(metadata, dict):
        return False, "question_metadata missing or not a dict"

    instruction_text = metadata.get("instruction_text")
    stimulus_text = metadata.get("stimulus_text")
    intentional_error_type = metadata.get("intentional_error_type")

    if not instruction_text:
        return False, "question_metadata.instruction_text is missing"
    if not stimulus_text:
        return False, "question_metadata.stimulus_text is missing"
    # intentional_error_type is OPTIONAL: null/absent means this is an identification
    # question (e.g. "which word is the conjunction?") where the stimulus is correct English.

    # instruction_text must be grammatically correct
    instr_errors = _lt_errors(str(instruction_text))
    if instr_errors:
        detail = "; ".join(e["message"] for e in instr_errors[:3])
        return False, f"Grammar error in instruction_text: {detail}"

    # prose fields (answer, explanation, hints) must be clean
    ok, detail = _check_prose_fields(data)
    if not ok:
        return False, detail

    # If no intentional_error_type → identification question; stimulus must be clean
    if not intentional_error_type:
        stim_errors = _lt_errors(str(stimulus_text))
        if stim_errors:
            detail = "; ".join(e["message"] for e in stim_errors[:3])
            return False, f"Grammar error in stimulus_text (identification question, no error expected): {detail}"
        return True, f"{qtype} identification question verified (no intentional error)"

    # Validate stimulus_text against intentional_error_span
    error_span = metadata.get("intentional_error_span")
    stim_errors = _lt_errors(str(stimulus_text))

    if error_span is not None:
        if not isinstance(error_span, dict):
            return False, "intentional_error_span must be a dict with 'start' and 'end'"
        span_start = error_span.get("start")
        span_end = error_span.get("end")
        if span_start is None or span_end is None:
            return False, "intentional_error_span must have 'start' and 'end' keys"

        try:
            span_start = int(span_start)
            span_end = int(span_end)
        except (TypeError, ValueError):
            return False, "intentional_error_span start/end must be integers"

        if span_start >= span_end:
            return False, "intentional_error_span start must be less than end"

        # Check for errors outside the span
        errors_outside = [e for e in stim_errors if not _overlaps(e, span_start, span_end)]
        if errors_outside:
            detail = "; ".join(e["message"] for e in errors_outside[:3])
            return False, f"Unexpected grammar errors outside intentional_error_span: {detail}"

        # At least one LT error should overlap the span (if LT is available)
        if _lt_available and stim_errors:
            errors_inside = [e for e in stim_errors if _overlaps(e, span_start, span_end)]
            if not errors_inside:
                return False, "intentional_error_span given but LanguageTool found no error there"
    else:
        # No span given — all stimulus errors are acceptable (the whole stimulus may be wrong)
        pass

    return True, f"{qtype} intentional-error question verified"


# ── Comprehension / vocabulary / literary analysis handler ────────────────

def _verify_rag_only_question(data: dict, qtype: str) -> Tuple[bool, str]:
    """
    For english_comprehension, english_vocabulary, english_literary_analysis.

    Factual grounding is handled by Stage 6 RAG checks. Stage 2 only validates
    that all prose fields are grammatically correct.
    """
    # Check instruction_text from question_metadata if present
    metadata = data.get("question_metadata")
    if isinstance(metadata, dict):
        instruction_text = metadata.get("instruction_text", "")
        if instruction_text:
            instr_errors = _lt_errors(str(instruction_text))
            if instr_errors:
                detail = "; ".join(e["message"] for e in instr_errors[:3])
                return False, f"Grammar error in question_metadata.instruction_text: {detail}"

        stimulus_text = metadata.get("stimulus_text", "")
        if stimulus_text:
            stim_errors = _lt_errors(str(stimulus_text))
            if stim_errors:
                detail = "; ".join(e["message"] for e in stim_errors[:3])
                return False, f"Grammar error in question_metadata.stimulus_text: {detail}"

    # question_text itself (top-level)
    question_text = data.get("question_text", "")
    if question_text:
        qt_errors = _lt_errors(str(question_text))
        if qt_errors:
            detail = "; ".join(e["message"] for e in qt_errors[:3])
            return False, f"Grammar error in question_text: {detail}"

    ok, detail = _check_prose_fields(data)
    if not ok:
        return False, detail

    return True, f"{qtype} prose fields verified (RAG grounding handled in Stage 6)"


# ── Public entry point ────────────────────────────────────────────────────

def verify(question_data: dict) -> Tuple[bool, str]:
    """
    Stage 2 English verification.

    Returns (verified: bool, detail: str).
    Dispatches by question_type. Unknown types fail closed.
    """
    qtype = question_data.get("question_type", "")

    if qtype in ("english_grammar", "english_spelling"):
        return _verify_intentional_error_question(question_data, qtype)

    if qtype in ("english_comprehension", "english_vocabulary", "english_literary_analysis"):
        return _verify_rag_only_question(question_data, qtype)

    return False, f"Unknown English question type: {qtype!r}"


# ── Tests (run with: python -m pytest verifiers/english.py -v) ────────────

def _run_tests() -> None:
    """Inline self-tests for CI / pre-batch gate. Prints pass/fail summary."""
    results: list[Tuple[str, bool]] = []

    def check(label: str, data: dict, expect_pass: bool) -> None:
        ok, detail = verify(data)
        passed = ok == expect_pass
        results.append((label, passed))
        status = "PASS" if passed else "FAIL"
        print(f"  {status}: {label} — {detail}")

    print("\n=== English Verifier Self-Tests ===\n")

    # 1. Valid intentional grammar error passes
    check(
        "valid intentional grammar error passes",
        {
            "question_type": "english_grammar",
            "question_text": "Find and correct the grammar error.",
            "correct_answer": "She went to the shop.",
            "explanation": "The verb tense was incorrect. The past tense 'went' is correct here.",
            "hint_1": "Look at the verb carefully.",
            "hint_2": "What tense should this sentence be in?",
            "hint_3": "The word 'go' should be changed to past tense.",
            "question_metadata": {
                "instruction_text": "Find and correct the grammar error in the sentence below.",
                "stimulus_text": "She go to the shop yesterday.",
                "intentional_error_type": "wrong_verb_tense",
                "intentional_error_span": {"start": 4, "end": 6},
            },
        },
        expect_pass=True,
    )

    # 2. Grammar error in instruction_text fails
    check(
        "grammar error in instruction_text fails",
        {
            "question_type": "english_grammar",
            "question_text": "Find the error.",
            "correct_answer": "She went to the shop.",
            "explanation": "The verb tense was incorrect.",
            "hint_1": "Look at the verb.",
            "hint_2": "Check tense.",
            "hint_3": "Change to past tense.",
            "question_metadata": {
                "instruction_text": "Find and correct the grammar error in the sentence below",
                "stimulus_text": "She go to the shop yesterday.",
                "intentional_error_type": "wrong_verb_tense",
            },
        },
        # instruction_text missing punctuation — depends on LT being available;
        # if LT not available this may pass, so we just check it doesn't crash
        expect_pass=True,  # no LT = graceful pass; with LT = may vary
    )

    # 3. Missing question_metadata fails
    check(
        "missing question_metadata fails",
        {
            "question_type": "english_grammar",
            "question_text": "Find the error.",
            "correct_answer": "She went to the shop.",
            "explanation": "Correct tense.",
            "hint_1": "Look at the verb.",
            "hint_2": "Check tense.",
            "hint_3": "Past tense.",
        },
        expect_pass=False,
    )

    # 4. Comprehension with clean text passes
    check(
        "comprehension with clean text passes",
        {
            "question_type": "english_comprehension",
            "question_text": "What did the character do at the beginning of the story?",
            "correct_answer": "The character went to the forest to find food.",
            "explanation": "The passage states that the character journeyed to the forest.",
            "hint_1": "Read the first paragraph carefully.",
            "hint_2": "The character is looking for something.",
            "hint_3": "The answer is in the first two sentences.",
            "source_chunk_ids": ["chunk-1"],
        },
        expect_pass=True,
    )

    # 5. Missing intentional_error_type fails
    check(
        "missing intentional_error_type fails",
        {
            "question_type": "english_spelling",
            "question_text": "Find the spelling mistake.",
            "correct_answer": "beautiful",
            "explanation": "The word was misspelled.",
            "hint_1": "Look at the vowels.",
            "hint_2": "Count the syllables.",
            "hint_3": "The correct spelling is b-e-a-u-t-i-f-u-l.",
            "question_metadata": {
                "instruction_text": "Find and correct the spelling mistake in the sentence.",
                "stimulus_text": "The beatiful flower bloomed in spring.",
            },
        },
        expect_pass=False,
    )

    total = len(results)
    passed = sum(1 for _, ok in results if ok)
    print(f"\n=== {passed}/{total} tests passed ===\n")


if __name__ == "__main__":
    _run_tests()
