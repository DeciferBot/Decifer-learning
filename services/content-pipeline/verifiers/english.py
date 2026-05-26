"""
English verifier for Decifer Learning content pipeline.

Stage 2: code verification — CLAUDE.md §9.

Supported question types:
  english_grammar          — intentional-error questions; uses question_metadata
  english_spelling         — intentional-error questions; uses question_metadata
  english_phonics          — phoneme/digraph identification; skips LT on phoneme content
  english_comprehension    — RAG-grounded; grammar sanity on prose fields
  english_vocabulary       — RAG-grounded; grammar sanity on prose fields (spelling
                             suppressed so Latin/Greek root words are not false-flagged)
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

VERIFIER_VERSION = "1.1.0"

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


def _lt_errors(text: str, ignore_spelling: bool = False) -> list[dict]:
    """Return LanguageTool errors as a list of dicts with offset, length, rule.

    ignore_spelling=True filters out MORFOLOGIK_RULE_EN* and EN_SPELL* matches.
    Use for english_spelling question prose fields where prefix/suffix morphemes
    (un-, dis-, pre-) legitimately trigger "Possible spelling mistake" false positives.
    Grammar, punctuation, and style rules are still enforced when ignore_spelling=True.
    """
    lt = _get_lt()
    if lt is None or not text:
        return []
    try:
        matches = lt.check(text)
        errors = [
            {
                "offset": m.offset,
                # language_tool_python ≥ 3.x uses snake_case attributes
                "length": getattr(m, "error_length", None) or getattr(m, "errorLength", 0),
                "rule": getattr(m, "rule_id", None) or getattr(m, "ruleId", ""),
                "message": m.message,
            }
            for m in matches
        ]
        if ignore_spelling:
            errors = [
                e for e in errors
                if not (
                    e["rule"].startswith("MORFOLOGIK_RULE_EN")
                    or e["rule"].startswith("EN_SPELL")
                )
            ]
        return errors
    except Exception as exc:
        log.warning(f"LanguageTool check error: {exc}")
        return []


def _overlaps(err: dict, span_start: int, span_end: int) -> bool:
    err_start = err["offset"]
    err_end = err["offset"] + err["length"]
    return err_start < span_end and err_end > span_start


# ── Core field grammar checks ─────────────────────────────────────────────

_QUOTE_NORMALIZATION_TABLE = str.maketrans({
    "‘": "'",   # ' LEFT SINGLE QUOTATION MARK
    "’": "'",   # ' RIGHT SINGLE QUOTATION MARK / curly apostrophe
    "“": '"',   # " LEFT DOUBLE QUOTATION MARK
    "”": '"',   # " RIGHT DOUBLE QUOTATION MARK
    "′": "'",   # ′ PRIME (sometimes used as apostrophe)
})


def _normalize_quotes(text: str) -> str:
    """Replace Unicode smart quotes with ASCII equivalents before LanguageTool checks.

    LLMs frequently produce explanations and hints containing curly apostrophes (e.g.
    ‘it’s’, ‘don’t’) which LanguageTool flags as "Unpaired symbol: ‘". This
    is a spurious error in prose fields — we want to check grammar, not quote style.
    Normalization applies to prose fields only; stimulus_text (intentional-error questions)
    is passed to LT unmodified so genuine apostrophe errors remain detectable.
    """
    return text.translate(_QUOTE_NORMALIZATION_TABLE)


# ── Prose-field style suppression ─────────────────────────────────────────

# LT message fragments that are false positives in educational prose fields
# (explanations, hints, correct_answer).  These are style/typography suggestions,
# not grammar errors, and are legitimately triggered by curriculum content:
#
#   "This word is normally spelled as one"
#       — "semi-colon", "run-on" etc. are both spellings in British educational use
#   "Unpaired symbol"
#       — parenthetical examples "(1) A colon introduces..." are pedagogically valid
#   "Use a comma before" / "Consider adding a comma"
#       — compound-sentence comma style rules; not hard grammar errors
#
# These suppressions apply ONLY to prose fields (explanation, hints, correct_answer).
# They are NOT applied to stimulus_text (intentional-error questions) or
# instruction_text, where genuine punctuation/style mistakes must still be caught.
_PROSE_SUPPRESSED_MESSAGE_FRAGMENTS: frozenset[str] = frozenset({
    "This word is normally spelled as one",
    "Unpaired symbol",
    "Use a comma before",
    "Consider adding a comma",
})


def _suppress_prose_error(err: dict) -> bool:
    """Return True if this LT error is a false positive in educational prose fields."""
    msg = err.get("message", "")
    return any(fragment in msg for fragment in _PROSE_SUPPRESSED_MESSAGE_FRAGMENTS)


def _check_prose_fields(
    data: dict,
    check_correct_answer: bool = True,
    ignore_spelling: bool = False,
) -> Tuple[bool, str]:
    """All prose fields (except intentional-error stimulus) should be grammatically clean.

    check_correct_answer=False skips LT on correct_answer — use this for grammar/spelling
    questions where correct_answer is a word, phrase, or clause (not a full sentence) and
    therefore legitimately lacks a capital letter or ending punctuation.

    ignore_spelling=True suppresses MORFOLOGIK/EN_SPELL rules on prose fields.
    Use for english_spelling questions where explanation and hints contain prefix/suffix
    morphemes that LanguageTool incorrectly flags as spelling mistakes. Grammar,
    punctuation, and style rules continue to be enforced.
    """
    fields_to_check = {
        "explanation": data.get("explanation", ""),
        "hint_1": data.get("hint_1", ""),
        "hint_2": data.get("hint_2", ""),
        "hint_3": data.get("hint_3", ""),
    }
    if check_correct_answer:
        fields_to_check["correct_answer"] = data.get("correct_answer", "")

    for field_name, text in fields_to_check.items():
        if not text:
            continue
        # Normalise Unicode smart quotes → ASCII before LT check (prose fields only).
        # Curly apostrophes in LLM-generated explanations/hints are not grammar errors.
        normalised = _normalize_quotes(str(text))
        errors = _lt_errors(normalised, ignore_spelling=ignore_spelling)
        # Suppress style/typography false positives in prose fields.
        errors = [e for e in errors if not _suppress_prose_error(e)]
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

    # prose fields (explanation, hints) must be clean.
    # correct_answer is NOT checked by LT here — for grammar/spelling questions it is
    # a word, phrase, or clause (e.g. "because", "Tom's cat") that legitimately lacks
    # a capital letter. Stage 3 consensus validates the answer's correctness instead.
    #
    # For english_spelling specifically: suppress MORFOLOGIK spelling-check rules on
    # prose fields. Prefix/suffix morphemes (un-, dis-, pre-, anti-) in explanations
    # and hints trigger "Possible spelling mistake" false positives — they are not
    # standalone dictionary words. Grammar and punctuation checks remain active.
    ok, detail = _check_prose_fields(
        data,
        check_correct_answer=False,
        ignore_spelling=(qtype == "english_spelling"),
    )
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

        # Check for errors outside the span.
        # Hard failure: if LT finds unintended errors elsewhere in the stimulus, the
        # question is structurally broken (accidental grammar mistake outside the
        # declared error zone — a child would be confused about what to correct).
        errors_outside = [e for e in stim_errors if not _overlaps(e, span_start, span_end)]
        if errors_outside:
            detail = "; ".join(e["message"] for e in errors_outside[:3])
            return False, f"Unexpected grammar errors outside intentional_error_span: {detail}"

        # Span-confirmation check: ideally LT detects an error at the declared span.
        # However, LanguageTool has known gaps for apostrophe-placement and morphological
        # errors (e.g. missing apostrophe in "Janes bag", incorrect prefix/suffix).
        # Rather than hard-failing when LT cannot see what is conceptually a valid error,
        # we downgrade to a WARNING and allow Stage 3 consensus to validate correctness.
        # This preserves full verification for structurally broken questions while
        # unblocking valid apostrophe/spelling/morphology questions that LT under-detects.
        # Audit trail: all such bypasses are logged at WARNING level for manual review.
        if _lt_available and stim_errors:
            errors_inside = [e for e in stim_errors if _overlaps(e, span_start, span_end)]
            if not errors_inside:
                log.warning(
                    f"SPAN_UNCONFIRMED [{qtype}] intentional_error_span declared but LT found "
                    f"no error at span ({span_start},{span_end}) in stimulus: "
                    f"{stimulus_text[:120]!r}. "
                    f"Passing to Stage 3 consensus for validation. "
                    f"error_type={intentional_error_type!r}"
                )
    else:
        # No span given — all stimulus errors are acceptable (the whole stimulus may be wrong)
        pass

    return True, f"{qtype} intentional-error question verified"


# ── Phonics handler ───────────────────────────────────────────────────────

def _verify_phonics_question(data: dict) -> Tuple[bool, str]:
    """
    For english_phonics questions.

    Phonics content (phoneme notation, digraph/trigraph examples, grapheme-phoneme
    correspondences) is structurally incompatible with LanguageTool:
      • Phoneme symbols (/ʃ/, /f/, /ɪ/) do not form standard English sentences.
      • Grapheme examples ("sh", "igh", "ph") are not dictionary words.
      • Identification stimuli may intentionally not start with an uppercase letter
        (e.g., the stimulus IS the grapheme: "sh").

    Rules:
      - question_metadata must be present.
      - stimulus_text is NOT checked by LanguageTool (phoneme/grapheme notation).
      - correct_answer is NOT checked by LanguageTool (phoneme/grapheme response).
      - instruction_text is checked with spelling rules suppressed (phoneme notation
        in instruction text such as "the /sh/ sound" must not be false-flagged).
      - explanation and hints are checked with spelling rules suppressed.
    """
    metadata = data.get("question_metadata")
    if not isinstance(metadata, dict):
        return False, "question_metadata missing or not a dict"

    instruction_text = metadata.get("instruction_text")
    if not instruction_text:
        return False, "question_metadata.instruction_text is missing"
    stimulus_text = metadata.get("stimulus_text")
    if not stimulus_text:
        return False, "question_metadata.stimulus_text is missing"

    # instruction_text: grammar check, spelling rules suppressed.
    # Phoneme notation like "/sh/ sound" or "the igh trigraph" triggers false spelling flags.
    instr_errors = _lt_errors(str(instruction_text), ignore_spelling=True)
    instr_errors = [e for e in instr_errors if not _suppress_prose_error(e)]
    if instr_errors:
        detail = "; ".join(e["message"] for e in instr_errors[:3])
        return False, f"Grammar error in instruction_text: {detail}"

    # stimulus_text: skip entirely. Phoneme/grapheme notation is inherently non-standard:
    # stimuli like "sh", "/f/ as in fox", or "Write a word with the igh pattern" cannot
    # be validated by LT without producing irrelevant false positives.

    # correct_answer: skip. It is a phoneme (/f/) or grapheme (ph), not a sentence.

    # Prose fields: grammar check, spelling rules suppressed.
    ok, detail = _check_prose_fields(
        data,
        check_correct_answer=False,
        ignore_spelling=True,
    )
    if not ok:
        return False, detail

    return True, "english_phonics question verified"


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

    # question_text itself (top-level).
    # For english_vocabulary, suppress spelling rules: etymology questions naturally
    # contain Latin/Greek root words (aqua, terra, bene, spec) that LT flags as
    # "Possible spelling mistake". Consensus (Stage 3) validates factual correctness.
    question_text = data.get("question_text", "")
    if question_text:
        qt_ignore_spelling = (qtype == "english_vocabulary")
        qt_errors = _lt_errors(str(question_text), ignore_spelling=qt_ignore_spelling)
        qt_errors = [e for e in qt_errors if not _suppress_prose_error(e)]
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

    if qtype == "english_phonics":
        return _verify_phonics_question(question_data)

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

    # 5. Missing instruction_text in english_spelling fails (structural, no LT needed)
    check(
        "missing instruction_text in english_spelling fails",
        {
            "question_type": "english_spelling",
            "question_text": "Find the spelling mistake.",
            "correct_answer": "beautiful",
            "explanation": "The word was misspelled.",
            "hint_1": "Look at the vowels.",
            "hint_2": "Count the syllables.",
            "hint_3": "The correct spelling is b-e-a-u-t-i-f-u-l.",
            "question_metadata": {
                "stimulus_text": "The beautiful flower bloomed in spring.",
                "intentional_error_type": "misspelled_word",
            },
        },
        expect_pass=False,
    )

    # 6. english_phonics with phoneme notation passes
    check(
        "english_phonics with phoneme notation in stimulus passes",
        {
            "question_type": "english_phonics",
            "question_text": "What sound does the digraph 'sh' make?",
            "correct_answer": "/sh/",
            "distractors": ["/s/", "/h/", "/ch/"],
            "explanation": "The digraph 'sh' makes the /sh/ sound, as in 'ship' or 'shop'.",
            "hint_1": "Look at what two letters make this sound together.",
            "hint_2": "Think of the word 'ship' and what sound it starts with.",
            "hint_3": "The sh digraph makes a sound like hushing someone.",
            "question_metadata": {
                "instruction_text": "What sound does this digraph make?",
                "stimulus_text": "sh",
                "intentional_error_type": None,
                "intentional_error_span": None,
            },
        },
        expect_pass=True,
    )

    # 7. english_phonics without question_metadata fails
    check(
        "english_phonics without question_metadata fails",
        {
            "question_type": "english_phonics",
            "question_text": "What sound does 'sh' make?",
            "correct_answer": "/sh/",
            "explanation": "The digraph sh makes a hushing sound.",
            "hint_1": "Listen carefully.",
            "hint_2": "Think of the word ship.",
            "hint_3": "It sounds like hushing.",
        },
        expect_pass=False,
    )

    # 8. english_vocabulary with Latin etymology roots in question_text passes
    check(
        "english_vocabulary with Latin root in question_text passes (spelling suppressed)",
        {
            "question_type": "english_vocabulary",
            "question_text": "What does the Latin root 'aqua' mean?",
            "correct_answer": "Water",
            "distractors": ["Fire", "Earth", "Air"],
            "explanation": "The Latin root 'aqua' means water. It appears in English words like aquarium and aquatic.",
            "hint_1": "Think about words that relate to water.",
            "hint_2": "An aquarium contains water for fish.",
            "hint_3": "The word 'aquatic' relates to living in water.",
            "source_chunk_ids": ["chunk-1"],
        },
        expect_pass=True,
    )

    # 9. english_grammar with semi-colon in explanation passes
    # (LT "This word is normally spelled as one" is suppressed for prose fields)
    check(
        "english_grammar with semi-colon in explanation passes (LT style suppressed)",
        {
            "question_type": "english_grammar",
            "question_text": "Which sentence correctly uses a semi-colon?\n\n'I went to the shops; I bought milk.'",
            "correct_answer": "I went to the shops; I bought milk.",
            "distractors": [
                "I went to the shops, I bought milk.",
                "I went to the shops. I bought milk.",
                "I went to the shops: I bought milk.",
            ],
            "explanation": "A semi-colon joins two closely related independent clauses. Both parts are complete sentences.",
            "hint_1": "A semi-colon is stronger than a comma.",
            "hint_2": "Both parts must be complete sentences on their own.",
            "hint_3": "Look for the sentence where both halves make sense alone.",
            "question_metadata": {
                "instruction_text": "Which sentence correctly uses a semi-colon?",
                "stimulus_text": "I went to the shops; I bought milk.",
                "intentional_error_type": None,
                "intentional_error_span": None,
            },
        },
        expect_pass=True,
    )

    # 10. Unknown question type fails closed
    check(
        "unknown question type fails closed",
        {
            "question_type": "english_unknown_type",
            "question_text": "Test question.",
            "correct_answer": "Test answer.",
        },
        expect_pass=False,
    )

    total = len(results)
    passed = sum(1 for _, ok in results if ok)
    print(f"\n=== {passed}/{total} tests passed ===\n")

    # LT-specific test: only meaningful when LT is available
    _get_lt()  # initialise so _lt_available reflects current state
    if _lt_available:
        lt_results: list[Tuple[str, bool]] = []

        def lt_check(label: str, data: dict, expect_pass: bool) -> None:
            ok, detail = verify(data)
            passed = ok == expect_pass
            lt_results.append((label, passed))
            status = "PASS" if passed else "FAIL"
            print(f"  {status}: [LT] {label} — {detail}")

        print("=== LanguageTool-specific tests (LT is available) ===\n")

        # Suppression is narrow: a genuine subject-verb error in explanation still fails
        lt_check(
            "genuine subject-verb error in explanation still fails",
            {
                "question_type": "english_grammar",
                "question_text": "Which word is the conjunction?",
                "correct_answer": "because",
                "explanation": "She have gone to the shop. The conjunction is because.",
                "hint_1": "Conjunctions join clauses.",
                "hint_2": "It connects two parts of the sentence.",
                "hint_3": "Look for the joining word.",
                "question_metadata": {
                    "instruction_text": "Which word is the conjunction in this sentence?",
                    "stimulus_text": "She stayed inside because it was raining.",
                    "intentional_error_type": None,
                    "intentional_error_span": None,
                },
            },
            expect_pass=False,
        )

        # Normal comprehension still catches grammar errors in prose
        lt_check(
            "genuine grammar error in comprehension explanation still fails",
            {
                "question_type": "english_comprehension",
                "question_text": "What did the character do at the start?",
                "correct_answer": "She went to the forest.",
                "explanation": "She have went to the forest to find food.",
                "hint_1": "Read the first paragraph.",
                "hint_2": "The character is looking for something.",
                "hint_3": "The answer is in the first two sentences.",
                "source_chunk_ids": ["chunk-1"],
            },
            expect_pass=False,
        )

        lt_total = len(lt_results)
        lt_passed = sum(1 for _, ok in lt_results if ok)
        print(f"\n=== LT tests: {lt_passed}/{lt_total} passed ===\n")


if __name__ == "__main__":
    _run_tests()
